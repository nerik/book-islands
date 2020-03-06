#!/usr/bin/env node
const fs = require('fs')
const turf = require('@turf/turf')
const progressBar = require('../util/progressBar')
const randomColor = require('../util/randomColor')
const pointWithinBBox = require('../util/pointWithinBBox')
const {
  BBOX_CHUNKS,
  BASE_ISLANDS_LOWDEF_MRCT,
  POINTS_WITH_SCORE,
  ISLANDS_LOWDEF,
} = require('../constants')
const {
  getIslandScaleForPriority,
  cheapIslandsAround,
  overlapsWithIslandsAround,
  getRandomPosAround,
} = require('./areaLayoutUtils')
const minBy = require('lodash/minBy')

const baseIslandsMrct = JSON.parse(fs.readFileSync(BASE_ISLANDS_LOWDEF_MRCT, 'utf-8'))

let allFeatures = []
BBOX_CHUNKS.forEach((bbox, chunkIndex) => {
  console.log('Loading points for bbox', bbox)
  const path = POINTS_WITH_SCORE.replace('.geo.json', `_${chunkIndex}.geo.json`)
  const bboxPoints = JSON.parse(fs.readFileSync(path, 'utf-8'))
  allFeatures = allFeatures.concat(bboxPoints.features)
})

allFeatures.sort((a, b) => {
  if (a.properties.children && !b.properties.children) return -1
  if (!a.properties.children && b.properties.children) return 1
  return b.properties.priority - a.properties.priority
})

console.log('Layouting', allFeatures.length, 'features')




const tryToPlaceIsland = (point, baseIslandMrct, foundScale) => {
  let island
  let finalScale
  let center
  let overlaps = true
  let currentAroundDist = 0
  const AROUND_INCREMENT = 0.02

  let tries = 0

  while (overlaps === true) {
    center = getRandomPosAround(point, currentAroundDist)
    const centerMrct = turf.toMercator(center)

    const { scale, islandAtScaleMrct } = getIslandScaleForPriority(
      point.properties.priority,
      centerMrct,
      baseIslandMrct,
      foundScale
    )

    finalScale = scale
    island = turf.toWgs84(islandAtScaleMrct)

    const islandsAround = cheapIslandsAround(allIslandsBuffers, point, 3)

    overlaps = overlapsWithIslandsAround(island, islandsAround)

    currentAroundDist += AROUND_INCREMENT
    tries++
  }

  // console.log('placed with ', tries, 'tries')
  return {
    island,
    scale: finalScale,
    center,
    currentAroundDist: currentAroundDist - AROUND_INCREMENT,
  }
}

const allIslandsBuffers = []

BBOX_CHUNKS.forEach((bboxChunk, chunkIndex) => {
  const bboxFilteredFeatures = allFeatures.filter((cluster) => {
    return pointWithinBBox(cluster, bboxChunk)
  })
  console.log(
    'Current chunk:',
    bboxChunk,
    chunkIndex,
    'with',
    bboxFilteredFeatures.length,
    'features'
  )

  const pb = progressBar(bboxFilteredFeatures.length)
  const bboxIslands = []

  bboxFilteredFeatures.forEach((point) => {
    const isCluster = point.properties.children !== undefined

    let baseIslandMrct
    let foundScale

    const defaultCenterMrct = turf.toMercator(point)

    if (point.properties.islands_by_score) {
      const scoredIslands = point.properties.islands_by_score
      // console.log('Trying to find island...', isCluster)
      let scoredIslandIndex = 0
      const MAX_SCORED_ISLAND_TRIES = 100
      const allScales = []

      for (
        scoredIslandIndex = 0;
        scoredIslandIndex < MAX_SCORED_ISLAND_TRIES - 1;
        scoredIslandIndex++
      ) {
        const islandMeta = scoredIslands[scoredIslandIndex]

        const islandsAround = cheapIslandsAround(allIslandsBuffers, point, 1)
        const islandsAroundIds = islandsAround.map((i) => i.properties.island_id)
        // console.log(islandMeta.id, islandsAroundIds)

        // There's already the same island close, use next
        if (islandsAroundIds.includes(islandMeta.id)) {
          continue
        }

        baseIslandMrct = baseIslandsMrct.features.find(
          (i) => i.properties.island_id === islandMeta.id
        )
        let scaleObj = getIslandScaleForPriority(
          point.properties.priority,
          defaultCenterMrct,
          baseIslandMrct,
          1
        )

        // if scale maxed out, try to start with a much higher value
        if (scaleObj.scale === 1) {
          scaleObj = getIslandScaleForPriority(
            point.properties.priority,
            defaultCenterMrct,
            baseIslandMrct,
            10
          )
        }

        allScales.push({ scale: scaleObj.scale, score: islandMeta.score, island_id: islandMeta.id })

        foundScale = scaleObj.scale

        // basically never pick an island that upscales to avoid ugly heights and island borders
        if (scaleObj.scale < 1) break
      }
      if (scoredIslandIndex === MAX_SCORED_ISLAND_TRIES - 1) {
        const lowestScale = minBy(allScales, 'scale')
        console.log(
          'Couldnt find island with no upscaling, will fallback to island with least upscaling\n',
          lowestScale,
          point.properties.author_slug
        )
        baseIslandMrct = baseIslandsMrct.features.find(
          (i) => i.properties.island_id === lowestScale.island_id
        )
      }
    } else {
      const rdIndex = Math.floor(Math.random() * baseIslandsMrct.features.length)
      baseIslandMrct = baseIslandsMrct.features[rdIndex]
    }

    const { island, scale, center, currentAroundDist } = tryToPlaceIsland(
      point,
      baseIslandMrct,
      foundScale ? foundScale : 1 // force using previously found value to avoid having to recalculate
    )

    const col = randomColor()

    island.properties = {
      ...island.properties,
      ...point.properties,
      currentAroundDist,
      scale,
      center,
      uniq_r: col.cluster_r,
      uniq_g: col.cluster_g,
      uniq_b: col.cluster_b,
    }

    allIslandsBuffers.push(turf.buffer(island, 0.005, { units: 'degrees' }))
    bboxIslands.push(island)
    pb.increment()
  })
  pb.stop()

  const islandsLowdefPath = ISLANDS_LOWDEF.replace('.geo.json', `_${chunkIndex}.geo.json`)
  fs.writeFileSync(islandsLowdefPath, JSON.stringify(turf.featureCollection(bboxIslands)))
  console.log('Wrote', islandsLowdefPath)
})
