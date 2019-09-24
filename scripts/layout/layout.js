#!/usr/bin/env node
const fs = require('fs')
const turf = require('@turf/turf')
const progressBar = require('../util/progressBar')
const transposeAndScale = require('../util/transposeAndScale')

const { CLUSTERS, BASE_ISLANDS_LOWDEF_MRCT, BASE_ISLANDS_META, ISLANDS_TRANS, ISLANDS_LOWDEF } = require('../constants')

const baseIslandsMrct = JSON.parse(fs.readFileSync(BASE_ISLANDS_LOWDEF_MRCT, 'utf-8'))
const baseIslandsMeta = JSON.parse(fs.readFileSync(BASE_ISLANDS_META, 'utf-8'))
const clusters = JSON.parse(fs.readFileSync(CLUSTERS, 'utf-8'))

// Get rid of whatever clusters did not get a score in the score step
// This happens when running score on a subset
const clustersFiltered = clusters.features.filter(cluster => {
  const islandCandidatesForCluster = baseIslandsMeta[cluster.properties.cluster_id.toString()]
  return islandCandidatesForCluster
})


// We might want to also sort by numbooks
const clustersByPop = clustersFiltered
  .sort((a, b) => b.properties.sum_popularity - a.properties.sum_popularity)


const islands = []
const finalTransformations = []



const cheapDistance = (clusterCenter, island) => {
  const sampleIslandPt = island.geometry.coordinates[0][0]
  const a = clusterCenter.geometry.coordinates[0] - sampleIslandPt[0]
  const b = clusterCenter.geometry.coordinates[1] - sampleIslandPt[1]
  return Math.hypot(a, b)
}

const cheapOverlap = (bbox1, bbox2) => {
  const [minX1, minY1, maxX1, maxY1] = bbox1
  const [minX2, minY2, maxX2, maxY2] = bbox2
  if (minX1 > minX2 )
}

const overlapsWithIslandsAround = (islandAtScaleMrct, islandsAround) => {
  const islandAtScale = turf.toWgs84(islandAtScaleMrct)
  const islandAtScaleBBox = turf.bbox(islandAtScale)
  for (let islandIndex = 0; islandIndex < islandsAround.length; islandIndex++) {
    const islandAround = islandsAround[islandIndex]
    // TODO start with bbox?
    // const overlaps = turf.booleanOverlap(islandAtScale, islandAround)
    const overlaps = turf.booleanDisjoint(islandAtScale, islandAround) === false
    if (overlaps) return true
  }
  return false
}

const getIslandAtFinalScale = (clusterCenterMrct, islandMrct, startScale, islandsAround) => {
  // const transposedNoScale = transposeAndScale(clusterCenterMrct, islandMrct, 1)
  let currentScale = startScale

  const STEP_INCREMENT = .2
  const maxNumIterations = Math.ceil(startScale/STEP_INCREMENT)

  for (let i = 0; i < maxNumIterations; i++) {
    const islandAtScaleMrct = transposeAndScale(clusterCenterMrct, islandMrct, currentScale)
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
    error: 'cantFit'
  }
}


let numFallbacked = 0
const pb = progressBar(clustersByPop.length)
for (let clusterIndex = 0; clusterIndex < clustersByPop.length; clusterIndex++) {
// for (let clusterIndex = 0; clusterIndex < 100; clusterIndex++) {
  const cluster = clustersByPop[clusterIndex]
  
  pb.increment()

  // Gather islands sorted by score for cluster (baseIslandsMeta)
  const islandCandidatesForCluster = baseIslandsMeta[cluster.properties.cluster_id.toString()]
  
  // console.log('Cluster', cluster.properties.cluster_id)
  // Gather islands within bbox around cluster center (cheap: large bbox/buffer and pick a polygon point)
  const islandsAround = islands.filter(island => cheapDistance(cluster, island) < 5)
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

  if (!error) {
    const island = turf.toWgs84(islandAtFinalScale)
    island.properties = {...cluster.properties}
    island.properties.island_id = bestIslandCandidate.island_id
  
    islands.push(island)
  }

}

console.log('Layouted ', islands.length, 'islands')
console.log('Had to fallback with ', numFallbacked, 'islands')


fs.writeFileSync(ISLANDS_LOWDEF, JSON.stringify(turf.featureCollection(islands)))
// fs.writeFileSync(ISLANDS_TRANS, JSON.stringify(finalTransformations))