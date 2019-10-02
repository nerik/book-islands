#!/usr/bin/env node
const fs = require('fs')
const turf = require('@turf/turf')
const progressBar = require('../util/progressBar')
const transposeAndScale = require('../util/transposeAndScale')

const { CLUSTERS, BASE_ISLANDS_LOWDEF_MRCT, BASE_ISLANDS_META, ISLANDS_META, ISLANDS_LOWDEF } = require('../constants')

const MIN_DISTANCE_SIMILAR_DEGREES = 5

const baseIslandsMrct = JSON.parse(fs.readFileSync(BASE_ISLANDS_LOWDEF_MRCT, 'utf-8'))
const baseIslandsMeta = JSON.parse(fs.readFileSync(BASE_ISLANDS_META, 'utf-8'))
const clusters = JSON.parse(fs.readFileSync(CLUSTERS, 'utf-8'))

// Get rid of whatever clusters did not get a score in the score step
// This happens when running score on a subset
const clustersFiltered = clusters.features.filter(cluster => {
  const islandCandidatesForCluster = baseIslandsMeta[cluster.properties.cluster_id.toString()]
  return islandCandidatesForCluster
})


// TODO: We might want to also sort by numbooks
const clustersByPop = clustersFiltered
  .sort((a, b) => b.properties.sum_popularity - a.properties.sum_popularity)


const islands = []
const finalTransformations = {}



const cheapDistance = (clusterCenter, island) => {
  const sampleIslandPt = island.geometry.coordinates[0][0]
  const a = clusterCenter.geometry.coordinates[0] - sampleIslandPt[0]
  const b = clusterCenter.geometry.coordinates[1] - sampleIslandPt[1]
  return Math.hypot(a, b)
}

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

const overlapsWithIslandsAround = (islandAtScaleMrct, islandsAround) => {
  const islandAtScale = turf.toWgs84(islandAtScaleMrct)
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

const getIslandAtFinalScale = (clusterCenterMrct, islandMrct, startScale, islandsAround) => {
  let currentScale = startScale
  let islandAtScaleMrct

  const STEP_INCREMENT = .05
  const maxNumIterations = Math.ceil(startScale/STEP_INCREMENT)

  for (let i = 0; i < maxNumIterations; i++) {
    islandAtScaleMrct = transposeAndScale(clusterCenterMrct, islandMrct, currentScale)
    // TODO do not send again islandsAround already marked as not overlapping?
    const overlaps = overlapsWithIslandsAround(islandAtScaleMrct, islandsAround)
    // scaling down and it now doesnt fit anymore: use prev
    if (!overlaps) {
      return {
        finalScale: currentScale,
        islandAtFinalScale: islandAtScaleMrct
      }
    }
    currentScale -= STEP_INCREMENT
  }

  return {
    error: 'cantFit',
    finalScale: currentScale + STEP_INCREMENT,
    islandAtFinalScale: islandAtScaleMrct
  }
}


let numFallbacked = 0
let numDidntFit = 0
const pb = progressBar(clustersByPop.length)
for (let clusterIndex = 0; clusterIndex < clustersByPop.length; clusterIndex++) {
// for (let clusterIndex = 0; clusterIndex < 100; clusterIndex++) {
  const cluster = clustersByPop[clusterIndex]
  
  pb.increment()

  // Gather islands sorted by score for cluster (baseIslandsMeta)
  const islandCandidatesForCluster = baseIslandsMeta[cluster.properties.cluster_id.toString()]
  
  // console.log('Cluster', cluster.properties.cluster_id)
  // Gather islands within bbox around cluster center (cheap: large bbox/buffer and pick a polygon point)
  const islandsAround = islands.filter(island => cheapDistance(cluster, island) < MIN_DISTANCE_SIMILAR_DEGREES)
  // console.log('Found', islandsAround.length, ' islands around')
  const islandsAroundIds = islandsAround.map(island => island.properties.island_id)

  // Get island with best score and not already within radius
  let bestIslandCandidate = islandCandidatesForCluster.find(
    islandCandidate => !islandsAroundIds.includes(islandCandidate.island_id)
  )
  if (!bestIslandCandidate || bestIslandCandidate.fitScore === 0) {
    console.log('No good candidate found, fallback to the one with best fitScore')
    numFallbacked++
    bestIslandCandidate = islandCandidatesForCluster[0]
  }
  // console.log(bestIslandCandidate)

  const clusterCenterMrct = turf.toMercator(cluster)
  const islandMrct = baseIslandsMrct.features.find(i => i.properties.island_id === bestIslandCandidate.island_id)
  // console.log(bestIslandCandidate)

  // Apply default transformation from baseIslandsMeta: use cluster center + scale
  // const transposedAndScaledIsland = transposeAndScale(clusterCenterMrct, islandMrct, bestIslandCandidate.newScale)
  // const island = turf.toWgs84(transposedAndScaledIsland)
  // island.properties = {...cluster.properties}
  // island.properties.island_id = bestIslandCandidate.island_id
  
  // islands.push(island)

  const { finalScale, islandAtFinalScale, error } = getIslandAtFinalScale(
    clusterCenterMrct, islandMrct, bestIslandCandidate.newScale, islandsAround
  )

  if (error) {
    numDidntFit++
  }
  const island = turf.toWgs84(islandAtFinalScale)
  island.properties = {...cluster.properties}
  island.properties.island_id = bestIslandCandidate.island_id

  islands.push(island)
  finalTransformations[cluster.properties.cluster_id] = {
    scoringScale: bestIslandCandidate.newScale,
    layoutScale: finalScale,
  }
}

console.log('Layouted ', islands.length, 'islands')
console.log('Had to fallback with ', numFallbacked, 'islands (couldnt find different enough neighbour)')
console.log('Islands didnt fit ', numDidntFit)


fs.writeFileSync(ISLANDS_LOWDEF, JSON.stringify(turf.featureCollection(islands)))
fs.writeFileSync(ISLANDS_META, JSON.stringify(finalTransformations))

console.log ('Wrote', ISLANDS_LOWDEF)
console.log ('Wrote', ISLANDS_META)