#!/usr/bin/env node
const fs = require('fs')
const turf = require('@turf/turf')
const progressBar = require('../util/progressBar')
const transposeAndScale = require('../util/transposeAndScale')
const pointWithinBBox = require('../util/pointWithinBBox')

const {
  CLUSTERS, BASE_ISLANDS_LOWDEF_MRCT, BASE_ISLANDS_META,
  ISLANDS_CANDIDATES_META, ISLANDS_LOWDEF,
  TEST_BBOX, BBOX_CHUNKS
} = require('../constants')

const MIN_DISTANCE_SIMILAR_DEGREES = 3

const baseIslandsMrct = JSON.parse(fs.readFileSync(BASE_ISLANDS_LOWDEF_MRCT, 'utf-8'))
const clusters = JSON.parse(fs.readFileSync(CLUSTERS, 'utf-8'))

let baseIslandsMeta = {}
BBOX_CHUNKS.forEach((bbox, chunkIndex) => {
  // if (chunkIndex >= 2) {
  //   return
  // }
  console.log('Adding meta for bbox', bbox)
  const path = BASE_ISLANDS_META.replace('.json', `_${chunkIndex}.json`)
  const bboxMeta = JSON.parse(fs.readFileSync(path, 'utf-8'))
  baseIslandsMeta = {
    ...baseIslandsMeta,
    ...bboxMeta
  }
})

const clustersFiltered = clusters.features
  // Remove clustered points (but keep clusters + standalone points)
  // .filter(cluster => {
  //   return cluster.properties.is_cluster || cluster.properties.cluster_id === undefined
  // })
  // Get rid of whatever clusters did not get a score in the score step
  // This happens when running score on a subset
  .filter(cluster => {
    if (cluster.properties.cluster_id === undefined) return true
    const clusterId = cluster.properties.cluster_id.toString()
    const islandCandidatesForCluster = baseIslandsMeta[clusterId]
    return islandCandidatesForCluster
  })
  .filter(
    cluster =>
      cluster.geometry.coordinates[0] > TEST_BBOX.minX &&
    cluster.geometry.coordinates[0] < TEST_BBOX.maxX &&
    cluster.geometry.coordinates[1] > TEST_BBOX.minY &&
    cluster.geometry.coordinates[1] < TEST_BBOX.maxY
  )


// give them a layout priority (popularity + numbooks)
clustersFiltered.forEach(cluster => {
  const numBooksMult = 1 + (cluster.properties.books_count - 1) * .5
  const popMult = 1 + cluster.properties.sum_popularity * .0001
  const layoutPriorityScore = popMult * numBooksMult
  cluster.properties.layoutPriorityScore = layoutPriorityScore
})

// Sort them by layout priority score so that first ones get lowest chance of being scaled down
const clustersByPop = clustersFiltered
  .sort((a, b) => b.properties.layoutPriorityScore - a.properties.layoutPriorityScore)


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




const getClusterBestIsland = (cluster, islandsAroundIds) => {
  // Gather islands sorted by score for cluster (baseIslandsMeta)
  const clusterId = cluster.properties.cluster_id.toString()
  const islandCandidatesForCluster = baseIslandsMeta[clusterId]

  // Get island with best score and not already within radius
  // (they should already be ordered by score, so first one works)
  let bestIslandCandidate = islandCandidatesForCluster.find(
    islandCandidate => !islandsAroundIds.includes(islandCandidate.island_id)
  )
  if (!bestIslandCandidate || bestIslandCandidate.fitScore === 0) {
    console.log('No good candidate found, fallback to the one with best fitScore')
    // numFallbacked++
    bestIslandCandidate = islandCandidatesForCluster[0]
  }
  return bestIslandCandidate
}


// standalone points should pick a random island, then scale it until its area matches layout priority score
const getStandalonePointBestIsland = (cluster, islandsAroundIds, clusterCenterMrct) => {
  // pick random island that is not around
  const islandsNotAround = baseIslandsMrct.features.filter(
    islandCandidate => {
      // console.log(islandCandidate.properties.island_id, islandsAroundIds)
      return !islandsAroundIds.includes(islandCandidate.properties.island_id)
    }
  )
  let islandMrct
  if (islandsNotAround.length > 0) {
    // pick island that is not already around
    const rd = Math.floor(Math.random() * islandsNotAround.length)
    islandMrct = islandsNotAround[rd]
  } else {
    // console.log('Warning: cant find any different island around')
    // fall back to just picking a random island
    const rd = Math.floor(Math.random() * baseIslandsMrct.features.length)
    islandMrct = baseIslandsMrct.features[rd]
  }

  const layoutPriorityScore = cluster.properties.layoutPriorityScore

  // how much scale must be decreased at each iteration to try to fit with target area
  const STEP_INCREMENT = .01

  // at which scale should we start with (tends to decrease size of big islands)
  const MAX_SCALE = .2

  // how to map priority score (composite of nym books and popularity) to target max area
  // smaller means more risk of running out of iterations and picking lowest possible scale
  // for small islands
  const MAP_PRIORITY_SCORE_WITH_AREA = 10000000
  const maxArea = layoutPriorityScore * MAP_PRIORITY_SCORE_WITH_AREA

  // scale down everything by this factor
  const OVERALL_SCALE_FACTOR = .5

  const maxNumIterations = Math.ceil(MAX_SCALE/STEP_INCREMENT) - 1
  let currentScale = MAX_SCALE
  let n = 0

  for (let i = 0; i < maxNumIterations; i++) {
    if(!clusterCenterMrct || !islandMrct) {
      console.log(clusterCenterMrct, islandMrct, islandsNotAround)
    }
    const islandAtScaleMrct = transposeAndScale(clusterCenterMrct, islandMrct, currentScale)
    const islandAtScaleArea = turf.area(turf.toWgs84(islandAtScaleMrct))
    n++
    if (islandAtScaleArea <= maxArea) {
      break
    }
    currentScale -= STEP_INCREMENT
  }
  // console.log(n)

  // console.log(currentScale, islandMrct.properties.island_id)
  // return scale and island id
  return {
    newScale: currentScale * OVERALL_SCALE_FACTOR,
    island_id: islandMrct.properties.island_id
  }
}

console.log('Will layout' , clustersByPop.length , 'clusters')

const islands = []

BBOX_CHUNKS.forEach((bboxChunk, chunkIndex) => {
  let numLayouted = 0
  const bboxIslands = []
  console.log('Current chunk:', bboxChunk, chunkIndex)

  const bboxFilteredClusters = clustersByPop
    .filter(cluster => {
      return (pointWithinBBox(cluster, bboxChunk))
    })


  // let numFallbacked = 0
  let numDidntFit = 0
  const finalTransformations = {}
  const pb = progressBar(bboxFilteredClusters.length)

  for (let clusterIndex = 0; clusterIndex < bboxFilteredClusters.length; clusterIndex++) {
    const cluster = bboxFilteredClusters[clusterIndex]

    pb.increment()


    // Gather islands within bbox around cluster center (cheap: large bbox/buffer and pick a polygon point)
    const islandsAround = islands.filter(island => cheapDistance(cluster, island) < MIN_DISTANCE_SIMILAR_DEGREES)
    // console.log('Found', islandsAround.length, ' islands around')
    const islandsAroundIds = islandsAround.map(island => island.properties.island_id)
    const clusterCenterMrct = turf.toMercator(cluster)

    const bestIslandCandidate = (cluster.properties.is_cluster)
      ? getClusterBestIsland(cluster, islandsAroundIds)
      : getStandalonePointBestIsland(cluster, islandsAroundIds, clusterCenterMrct)

    // console.log(bestIslandCandidate)

    const islandMrct = baseIslandsMrct.features.find(i => i.properties.island_id === bestIslandCandidate.island_id)
    // console.log(bestIslandCandidate)

    const { finalScale, islandAtFinalScale, error } = getIslandAtFinalScale(
      clusterCenterMrct, islandMrct, bestIslandCandidate.newScale, islandsAround
    )

    const layouted_id = cluster.properties.layouted_id

    if (error) {
      numDidntFit++
      finalTransformations[layouted_id] = {
        error
      }
      continue
    }


    const island = turf.toWgs84(islandAtFinalScale)
    island.properties = {
      ...cluster.properties,
      layouted_id
    }
    island.properties.island_id = bestIslandCandidate.island_id

    islands.push(island)
    bboxIslands.push(island)
    numLayouted++

    finalTransformations[layouted_id] = {
      scoringScale: bestIslandCandidate.newScale,
      island_id: bestIslandCandidate.island_id,
      layoutScale: finalScale,
      center: cluster.geometry.coordinates,
      error
    }
  }

  console.log('Layouted ', numLayouted, 'islands')
  // console.log('Had to fallback with ', numFallbacked, 'islands (couldnt find different enough neighbour)')
  console.log('Islands didnt fit:', numDidntFit)

  const islandsMetaPath = ISLANDS_CANDIDATES_META.replace('.json', `_${chunkIndex}.json`)
  fs.writeFileSync(islandsMetaPath, JSON.stringify(finalTransformations))
  console.log ('Wrote', islandsMetaPath)
  const islandsLowdefPath = ISLANDS_LOWDEF.replace('.geo.json', `_${chunkIndex}.geo.json`)
  fs.writeFileSync(islandsLowdefPath, JSON.stringify(turf.featureCollection(bboxIslands)))
  console.log ('Wrote', islandsLowdefPath)
  pb.stop()
})

console.log('All completed. Layouted ', islands.length, 'islands')
