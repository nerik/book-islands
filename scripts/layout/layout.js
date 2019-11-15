#!/usr/bin/env node
const fs = require('fs')
const turf = require('@turf/turf')
const _ = require('lodash')
const progressBar = require('../util/progressBar')
const transposeAndScale = require('../util/transposeAndScale')
const pointWithinBBox = require('../util/pointWithinBBox')
const getAuthorLayoutPriority = require('../util/getAuthorLayoutPriority')
const bboxRatio = require('../util/bboxRatio')
const computeClusterStats = require('./util/computeClusterStats')

const {
  CLUSTERS,
  BASE_ISLANDS_LOWDEF_MRCT,
  BASE_ISLANDS_META,
  ISLANDS_CANDIDATES_META,
  ISLANDS_LOWDEF,
  LAYOUTED_CLUSTERS,
  TEST_BBOX,
  BBOX_CHUNKS,
} = require('../constants')

// Minimum radius in degrees to consider an identical island shouldnt be too close with
const MIN_DISTANCE_SIMILAR_DEGREES = 3

const baseIslandsMrct = JSON.parse(fs.readFileSync(BASE_ISLANDS_LOWDEF_MRCT, 'utf-8'))
const points = JSON.parse(fs.readFileSync(CLUSTERS, 'utf-8'))

let baseIslandsMeta = {}
BBOX_CHUNKS.forEach((bbox, chunkIndex) => {
  console.log('Adding meta for bbox', bbox)
  const path = BASE_ISLANDS_META.replace('.json', `_${chunkIndex}.json`)
  const bboxMeta = JSON.parse(fs.readFileSync(path, 'utf-8'))
  baseIslandsMeta = {
    ...baseIslandsMeta,
    ...bboxMeta,
  }
})

const filteredPoints = points.features
  // Get rid of whatever clusters did not get a score in the score step
  // This happens when running score on a subset
  .filter((cluster) => {
    if (cluster.properties.cluster_id === undefined) return true
    const clusterId = cluster.properties.cluster_id.toString()
    const islandCandidatesForCluster = baseIslandsMeta[clusterId]
    return islandCandidatesForCluster
  })
  .filter(
    (cluster) =>
      cluster.geometry.coordinates[0] > TEST_BBOX.minX &&
      cluster.geometry.coordinates[0] < TEST_BBOX.maxX &&
      cluster.geometry.coordinates[1] > TEST_BBOX.minY &&
      cluster.geometry.coordinates[1] < TEST_BBOX.maxY
  )

// Filter out cluster children. Main loop will only operate on points that yield islands,
// so either clusters or standalone points, not cluster children
const islandPoints = filteredPoints.filter(
  (cluster) => cluster.properties.is_cluster === true || cluster.properties.cluster_id === undefined
)

// give them a layout priority (popularity + numbooks)
filteredPoints.forEach((cluster) => {
  cluster.properties.layoutPriorityScore = getAuthorLayoutPriority(cluster.properties)
})

// Sort them by layout priority score so that first ones get lowest chance of being scaled down
const islandPointsByPriority = islandPoints.sort(
  (a, b) => b.properties.layoutPriorityScore - a.properties.layoutPriorityScore
)

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

// Check if an island overlaps with surrounding islands
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

// Decreases an island scale until it doesn't overlap with surrounding islands
const getIslandAtFinalScale = (clusterCenterMrct, islandMrct, startScale, islandsAround) => {
  let currentScale = startScale
  let islandAtScaleMrct

  // How much should we decrease scale when trying again
  const STEP_DECREMENT = 0.05

  // Multiplicator applied when it finally fits. Avoid big cluster islands being too close to everything
  const FINAL_SCALE_MULT = 0.8
  const maxNumIterations = Math.ceil(startScale / STEP_DECREMENT)

  for (let i = 0; i < maxNumIterations; i++) {
    islandAtScaleMrct = transposeAndScale(clusterCenterMrct, islandMrct, currentScale)
    const overlaps = overlapsWithIslandsAround(islandAtScaleMrct, islandsAround)
    if (!overlaps) {
      const finalScale = currentScale * FINAL_SCALE_MULT
      return {
        finalScale,
        islandAtFinalScale: transposeAndScale(clusterCenterMrct, islandMrct, finalScale),
      }
    }
    currentScale -= STEP_DECREMENT
  }
  return {
    error: 'cantFit',
    finalScale: currentScale + STEP_DECREMENT,
    islandAtFinalScale: islandAtScaleMrct,
  }
}

// Get best island for a cluster, picking island with best score that is not around
const getClusterBestIsland = (cluster, islandsAroundIds) => {
  // Gather islands sorted by score for cluster (baseIslandsMeta)
  const clusterId = cluster.properties.layouted_id.toString()
  const islandCandidatesForCluster = baseIslandsMeta[clusterId]

  // Get island with best score and not already within radius
  // (they should already be ordered by score, so first one works)
  let bestIslandCandidate = islandCandidatesForCluster.find(
    (islandCandidate) => !islandsAroundIds.includes(islandCandidate.island_id)
  )
  if (!bestIslandCandidate || bestIslandCandidate.fitScore === 0) {
    console.log('No good candidate found, fallback to the one with best fitScore')
    // numFallbacked++
    bestIslandCandidate = islandCandidatesForCluster[0]
  }
  return bestIslandCandidate
}

// Get best island for a single standalone point
// Standalone points pick a random island, then scale it until its area matches layout priority score
// It does not checks if scaled island overlaps with neighbours
const getStandalonePointBestIsland = (cluster, islandsAroundIds, clusterCenterMrct) => {
  // pick random island that is not around
  const islandsNotAround = baseIslandsMrct.features.filter((islandCandidate) => {
    // console.log(islandCandidate.properties.island_id, islandsAroundIds)
    return !islandsAroundIds.includes(islandCandidate.properties.island_id)
  })
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
  const STEP_DECREMENT = 0.01

  // at which scale should we start with (tends to decrease size of big islands)
  const MAX_SCALE = 0.4

  // how to map priority score (composite of num books and popularity) to target max area
  // smaller means more risk of running out of iterations and picking lowest possible scale
  // for small islands
  const MAP_PRIORITY_SCORE_WITH_AREA = 10000000
  const maxArea = layoutPriorityScore * MAP_PRIORITY_SCORE_WITH_AREA

  // scale down everything by this factor
  const OVERALL_SCALE_FACTOR = 0.5

  const maxNumIterations = Math.ceil(MAX_SCALE / STEP_DECREMENT) - 1
  let currentScale = MAX_SCALE
  // let n = 0

  for (let i = 0; i < maxNumIterations; i++) {
    if (!clusterCenterMrct || !islandMrct) {
      console.log(clusterCenterMrct, islandMrct, islandsNotAround)
    }
    const islandAtScaleMrct = transposeAndScale(clusterCenterMrct, islandMrct, currentScale)
    const islandAtScaleArea = turf.area(turf.toWgs84(islandAtScaleMrct))
    // TODO: review why island doesn't always use the same size
    // if (layoutPriorityScore === 0.5) {
    //   console.log(currentScale)
    // }
    // n++
    if (islandAtScaleArea <= maxArea) {
      break
    }
    currentScale -= STEP_DECREMENT
  }
  // console.log(n)
  return {
    newScale: currentScale * OVERALL_SCALE_FACTOR,
    island_id: islandMrct.properties.island_id,
  }
}

console.log('Will layout', islandPointsByPriority.length, 'clusters')

const islands = []
const layoutedPoints = []

BBOX_CHUNKS.forEach((bboxChunk, chunkIndex) => {
  let numLayouted = 0
  const bboxIslands = []
  console.log('Current chunk:', bboxChunk, chunkIndex)

  const bboxFilteredPoints = islandPointsByPriority.filter((cluster) => {
    return pointWithinBBox(cluster, bboxChunk)
  })

  let numDidntFit = 0
  const finalTransformations = {}
  const pb = progressBar(bboxFilteredPoints.length)

  for (let clusterIndex = 0; clusterIndex < bboxFilteredPoints.length; clusterIndex++) {
    const cluster = bboxFilteredPoints[clusterIndex]

    pb.increment()

    // ----- 1. Get best of scored island while trying to fit with already existing islands -----

    // Might have been skipped previously if attached to another cluster
    if (cluster.skip === true) {
      continue
    }

    const getIslandAndMeta = (_cluster, doNotDownscale) => {
      // Gather islands within bbox around cluster center (cheap: large bbox/buffer and pick a polygon point)
      const islandsAround = islands.filter(
        (island) => cheapDistance(_cluster, island) < MIN_DISTANCE_SIMILAR_DEGREES
      )
      // console.log('Found', islandsAround.length, ' islands around')
      const islandsAroundIds = islandsAround.map((island) => island.properties.island_id)

      const clusterCenterMrct = turf.toMercator(_cluster)
      const bestIslandCandidate =
        _cluster.properties.is_cluster === true
          ? getClusterBestIsland(_cluster, islandsAroundIds)
          : getStandalonePointBestIsland(
              _cluster,
              islandsAroundIds,
              clusterCenterMrct,
              doNotDownscale
            )

      const islandMrct = baseIslandsMrct.features.find(
        (i) => i.properties.island_id === bestIslandCandidate.island_id
      )
      if (!islandMrct) {
        return { error: 'bestIslandCandidate not found' }
      }
      const { finalScale, islandAtFinalScale, error } = getIslandAtFinalScale(
        clusterCenterMrct,
        islandMrct,
        bestIslandCandidate.newScale,
        islandsAround
      )

      const finalIsland = turf.toWgs84(islandAtFinalScale)

      finalIsland.properties = {
        layouted_id: _cluster.properties.layouted_id,
        r: bboxRatio(turf.bbox(finalIsland)),
      }
      finalIsland.bbox = turf.bbox(finalIsland)
      finalIsland.properties.island_id = bestIslandCandidate.island_id
      finalIsland.properties.author_id = _cluster.properties.author_id
      return {
        finalIsland,
        finalScale,
        error,
      }
    }

    const layouted_id = cluster.properties.layouted_id
    const { finalIsland, finalScale, error } = getIslandAndMeta(cluster, islands)

    if (error) {
      numDidntFit++
    }

    bboxIslands.push(finalIsland)
    numLayouted++

    finalTransformations[layouted_id] = {
      island_id: finalIsland.properties.island_id,
      layoutScale: finalScale,
      center: cluster.geometry.coordinates,
      error,
    }

    layoutedPoints.push(cluster)

    // ----- 2. Re-arrange cluster after island has been layouted (refit cluster points) -----

    if (cluster.properties.is_cluster === true) {
      // get cluster children from non-island list
      let clusterChildren = filteredPoints
        .filter((clusteredPoint) => clusteredPoint.skip !== true)
        .filter((clusteredPoint) => {
          return clusteredPoint.properties.cluster_id === cluster.properties.layouted_id
        })

      // If cluster, move cluster points back inside island if they are out of island due to downscaling
      const closestPolygonPoints = []
      const islandPoints = turf.coordAll(finalIsland).map((c) => turf.point(c))
      clusterChildren = clusterChildren.map((clusterChild) => {
        if (!turf.booleanPointInPolygon(clusterChild, finalIsland)) {
          const closestPolygonPoint = _.minBy(islandPoints, (polygonPoint) => {
            if (closestPolygonPoints.includes(polygonPoint)) {
              return null
            }
            return turf.distance(polygonPoint, clusterChild)
          })
          // console.log(closestPolygonPoint)
          closestPolygonPoints.push(closestPolygonPoint)
          return {
            ...closestPolygonPoint,
            properties: {
              ...clusterChild.properties,
            },
          }
        }
        return clusterChild
      })
      clusterChildren.forEach((clusterChild) => {
        layoutedPoints.push(clusterChild)
      })
    }

    // ----- 3. Edit OTHER points/clusters after island has been layouted -----------
    if (cluster.properties.is_cluster === true) {
      // Loop through remaining standalone and clustered points (no clusters)
      //
      // If point within just created island:
      //   If just created island is not a cluster, create it???
      //   Attach point to island cluster
      //   If point belonged to another cluster
      //     Check if other cluster is not already layouted !!
      //       Remove point from other cluster
      //       If other cluster is left with only one
      //          Demote cluster to standalone pt
      filteredPoints
        // no clusters
        .filter((point) => point.properties.is_cluster !== true)
        // no children of the current cluster
        .filter((point) => point.properties.cluster_id !== cluster.properties.layouted_id)
        .forEach((point) => {
          if (turf.booleanPointInPolygon(point, finalIsland)) {
            // Point belongs to the currently picked island:
            // - skip it for next iterations
            // - attach to current cluster
            // - detach from parent cluster if needed
            // - if parent cluster ends up being empty (having no children), skip cluster for next
            // - if parent cluster still viable (has more than 1pt), recalculate cluster center
            // mark as skip so that this doesnt get layouted later (in a futur step of the for loop)
            point.skip = true

            // Attach point to current cluster
            point.properties.cluster_id_old = point.properties.cluster_id
            point.properties.cluster_id = cluster.properties.layouted_id
            point.properties.cluster_r = cluster.properties.cluster_r
            point.properties.cluster_g = cluster.properties.cluster_g
            point.properties.cluster_b = cluster.properties.cluster_b
            if (!layoutedPoints.includes(point)) {
              layoutedPoints.push(point)
            }

            // Recalculate stats on current cluster
            const currentClusterNewChildren = filteredPoints.filter(
              (p) => p.properties.cluster_id === cluster.properties.layouted_id
            )
            cluster.properties = {
              ...cluster.properties,
              ...computeClusterStats(currentClusterNewChildren),
            }

            const previousParentClusterId = point.properties.cluster_id_old
            const pointLayoutedId = point.properties.layouted_id

            if (previousParentClusterId !== undefined) {
              const previousParentCluster = filteredPoints.find(
                (pt) => pt.properties.layouted_id === previousParentClusterId
              )

              // remove point from previous parent cluster
              const childIndex = previousParentCluster.properties.children.findIndex(
                (id) => id === pointLayoutedId
              )
              previousParentCluster.properties.children.splice(childIndex, 1)
              // previousParentCluster.properties.cluster_point_count = previousParentCluster.properties.children.length

              // If cluster is now empty (0 children), OR if cluster is not viable (only has one element which has just been
              // attached to another cluster) -> mark as skip - will be ignored from layout
              if (previousParentCluster.properties.children.length <= 1) {
                previousParentCluster.skip = true
              } else {
                // recalculate cluster center
                let previousParentClusterChildren = filteredPoints.filter(
                  (clusteredPoint) =>
                    clusteredPoint.properties.cluster_id === previousParentClusterId
                )

                if (previousParentClusterChildren.length > 1) {
                  const previousParentClusterNewCenter = turf.centerOfMass(
                    turf.featureCollection(previousParentClusterChildren)
                  )
                  previousParentCluster.geometry = previousParentClusterNewCenter.geometry
                  previousParentCluster.properties = {
                    ...previousParentCluster.properties,
                    ...computeClusterStats(previousParentClusterChildren),
                  }
                } else {
                  console.log('That shouldnt happen')
                  // Remove
                  previousParentCluster.skip = true
                }
              }
            }
          }
        })
    }

    // ----- 4. Generate fallback islands for cluster children -----------
    if (cluster.properties.is_cluster === true) {
      // Generate fallback islands/meta for cluster children.
      // It's done by layouting not taking into account current cluster island
      let clusterChildren = filteredPoints.filter((clusteredPoint) => {
        return clusteredPoint.properties.cluster_id === cluster.properties.layouted_id
      })
      clusterChildren.forEach((child) => {
        // Generate meta
        const fallbackIslandProps = getIslandAndMeta(child, true)
        fallbackIslandProps.finalIsland.properties.is_fallback = true
        bboxIslands.push(fallbackIslandProps.finalIsland)
        finalTransformations[child.properties.layouted_id] = {
          is_fallback: true,
          island_id: fallbackIslandProps.finalIsland.properties.island_id,
          layoutScale: fallbackIslandProps.finalScale,
          center: child.geometry.coordinates,
        }
      })
    }

    islands.push(finalIsland)
  }

  console.log('Layouted ', numLayouted, 'islands')
  // console.log('Had to fallback with ', numFallbacked, 'islands (couldnt find different enough neighbour)')
  console.log('Islands didnt fit:', numDidntFit)

  const islandsMetaPath = ISLANDS_CANDIDATES_META.replace('.json', `_${chunkIndex}.json`)
  fs.writeFileSync(islandsMetaPath, JSON.stringify(finalTransformations))
  console.log('Wrote', islandsMetaPath)
  const islandsLowdefPath = ISLANDS_LOWDEF.replace('.geo.json', `_${chunkIndex}.geo.json`)
  fs.writeFileSync(islandsLowdefPath, JSON.stringify(turf.featureCollection(bboxIslands)))
  console.log('Wrote', islandsLowdefPath)
  pb.stop()
})

console.log('All completed. Layouted ', islands.length, 'islands')

fs.writeFileSync(LAYOUTED_CLUSTERS, JSON.stringify(turf.featureCollection(layoutedPoints)))
console.log('Wrote', LAYOUTED_CLUSTERS)
