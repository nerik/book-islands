const turf = require('@turf/turf')
const transposeAndScale = require('../util/transposeAndScale')

const getIslandScaleForPriority = (score, clusterCenterMrct, islandMrct, maxScale = null) => {
  // TODO randomize score a little bit if it is low??
  // TODO how to have median values a bit exaggerated??

  // at which scale should we start with (tends to decrease size of big islands)
  const MAX_SCALE = maxScale || 10

  // how much scale must be decreased at each iteration to try to fit with target area
  const STEP_DECREMENT = MAX_SCALE / 100

  // how to map priority score (composite of num books and popularity) to target max area
  // smaller means more risk of running out of iterations and picking lowest possible scale
  // for small islands
  const MAP_PRIORITY_SCORE_WITH_AREA = 500000
  const maxArea = Math.pow(score, 1.5) * MAP_PRIORITY_SCORE_WITH_AREA

  // scale everything by this factor
  const OVERALL_SCALE_FACTOR = 1

  // that motherfucker shakespeare is getting too fucking big you fucking fat fuck
  const ABSOLUTE_MAX_AREA = 10000000000

  const maxNumIterations = Math.ceil(MAX_SCALE / STEP_DECREMENT) - 1
  let currentScale = MAX_SCALE + STEP_DECREMENT
  let islandAtScaleMrct
  let islandAtScaleArea

  let i = 0
  for (i = 0; i < maxNumIterations; i++) {
    currentScale -= STEP_DECREMENT
    islandAtScaleMrct = transposeAndScale(clusterCenterMrct, islandMrct, currentScale)
    islandAtScaleArea = turf.area(turf.toWgs84(islandAtScaleMrct))

    if (islandAtScaleArea <= maxArea && islandAtScaleArea < ABSOLUTE_MAX_AREA) {
      break
    }
  }
  // console.log('got scale:', currentScale, 'for prio after', i, 'tries', 'maxsc:', MAX_SCALE, 'stepDec', STEP_DECREMENT)
  return {
    scale: currentScale * OVERALL_SCALE_FACTOR,
    islandAtScaleMrct,
    islandAtScaleArea,
  }
}

const cheapDistance = (clusterCenter, island) => {
  const sampleIslandPt = island.geometry.coordinates[0][0]
  const a = clusterCenter.geometry.coordinates[0] - sampleIslandPt[0]
  const b = clusterCenter.geometry.coordinates[1] - sampleIslandPt[1]
  return Math.hypot(a, b)
}

// Cheap bbox overlap
const cheapOverlap = (bbox1, bbox2) => {
  const [minX1, minY1, maxX1, maxY1] = bbox1
  const [minX2, minY2, maxX2, maxY2] = bbox2
  if (minX1 > minX2 && maxX1 < maxX2) return true

  if (maxX1 < minX2) return false
  if (maxX2 < minX1) return false
  if (maxY1 < minY2) return false
  if (maxY2 < minY1) return false
  return true
}

const cheapIslandsAround = (islands, center, distDegrees) => {
  return islands.filter((island) => cheapDistance(center, island) < distDegrees)
}

// Check if an island overlaps with surrounding islands
const overlapsWithIslandsAround = (islandAtScale, islandsAround) => {
  // const islandAtScale = turf.toWgs84(islandAtScaleMrct)
  const islandAtScaleBBox = turf.bbox(islandAtScale)
  for (let islandIndex = 0; islandIndex < islandsAround.length; islandIndex++) {
    const islandAround = islandsAround[islandIndex]

    const overlapsFast = cheapOverlap(islandAtScaleBBox, turf.bbox(islandAround))
    if (overlapsFast) {
      const overlaps = turf.booleanDisjoint(islandAtScale, islandAround) === false
      if (overlaps) return true
    }
  }
  return false
}

const getRandomPosAround = (center, distDegrees) => {
  const lon = center.geometry.coordinates[0]
  const lat = center.geometry.coordinates[1]
  return turf.point(
    [
      lon - distDegrees / 2 + Math.random() * distDegrees,
      lat - distDegrees / 2 + Math.random() * distDegrees,
    ],
    { ...center.properties }
  )
}

module.exports = {
  getIslandScaleForPriority,
  cheapIslandsAround,
  overlapsWithIslandsAround,
  getRandomPosAround,
}
