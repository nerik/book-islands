#!/usr/bin/env node
const fs = require('fs')
const turf = require('@turf/turf')
const workerpool = require('workerpool')
const progressBar = require('../util/progressBar')
const pointWithinBBox = require('../util/pointWithinBBox')
const transposeAndScale = require('../util/transposeAndScale')
const tryGetTerritories = require('./util/tryGetTerritories')

const {
  LAYOUTED_CLUSTERS,
  ISLANDS_CANDIDATES_META,
  BASE_ISLANDS_LOWDEF_MRCT,
  TERRITORY_LINES,
  TERRITORY_POLYGONS,
  ISLANDS_FINAL_META,
  TEST_BBOX,
  BBOX_CHUNKS
} = require('../constants')

const POOL_PATH = __dirname + '/util/territoryWorker.js'
const USE_WORKERS = true

const points = JSON.parse(fs.readFileSync(LAYOUTED_CLUSTERS, 'utf-8'))
const baseIslandsMrct = JSON.parse(
  fs.readFileSync(BASE_ISLANDS_LOWDEF_MRCT, 'utf-8')
)

const filteredPoints = points.features
  .filter((cluster) => {
    if (!cluster.geometry) {
      console.log('Cluster with no geometry', cluster)
      return false
    }
    return (
      cluster.geometry.coordinates[0] > TEST_BBOX.minX &&
      cluster.geometry.coordinates[0] < TEST_BBOX.maxX &&
      cluster.geometry.coordinates[1] > TEST_BBOX.minY &&
      cluster.geometry.coordinates[1] < TEST_BBOX.maxY
    )
  })
  // Remove clusterED points (but keep clusters + standalone points)
  .filter((cluster) => {
    return (
      cluster.properties.is_cluster === true ||
      cluster.properties.cluster_id === undefined
    )
  })

console.log(
  'Will try to do territories for:',
  filteredPoints.length,
  'clusters and standalone points'
)

let chunkIndex = 0

const done = () => {
  console.log('done.')
}

// Run pools in sequence (wait for a bbox chunk to finish before starting a new one)
const execBBoxChunk = () => {
  const bboxChunk = BBOX_CHUNKS[chunkIndex]
  console.log('Current chunk:', bboxChunk, chunkIndex)
  const bboxFilteredPoints = filteredPoints.filter((cluster) => {
    return pointWithinBBox(cluster, bboxChunk)
  })

  const islandsMetaPath = ISLANDS_CANDIDATES_META.replace(
    '.json',
    `_${chunkIndex}.json`
  )
  const islandsMeta = JSON.parse(fs.readFileSync(islandsMetaPath, 'utf-8'))

  const numClusters = bboxFilteredPoints.filter(
    (p) => p.properties.is_cluster === true
  ).length
  console.log(
    'For chunk:',
    bboxFilteredPoints.length,
    'points, ',
    numClusters,
    'clusters'
  )

  const pool = workerpool.pool(POOL_PATH, { workerType: 'process' })
  let numClustersTried = 0
  let numClustersSucceeded = 0
  let numFeatures = 0

  const territoriesLines = []
  const territoriesPolygons = []

  const finalMeta = []

  const writeChunk = () => {
    console.log(
      'Cluster success: ',
      numClustersSucceeded,
      '/',
      numClustersTried
    )
    console.log('Created ', territoriesPolygons.length, 'territories')

    const territoryPolygonsPath = TERRITORY_POLYGONS.replace(
      '.geo.json',
      `_${chunkIndex}.geo.json`
    )
    const territoryLinesPath = TERRITORY_LINES.replace(
      '.geo.json',
      `_${chunkIndex}.geo.json`
    )
    fs.writeFileSync(
      territoryPolygonsPath,
      JSON.stringify(turf.featureCollection(territoriesPolygons))
    )
    fs.writeFileSync(
      territoryLinesPath,
      JSON.stringify(turf.featureCollection(territoriesLines))
    )
    console.log('Wrote', territoryPolygonsPath)
    console.log('Wrote', territoryLinesPath)

    const finalMetaPath = ISLANDS_FINAL_META.replace(
      '.json',
      `_${chunkIndex}.json`
    )
    fs.writeFileSync(finalMetaPath, JSON.stringify(finalMeta))
    console.log('Wrote', finalMetaPath)
  }

  // when bbox is empty (because TEST_BBOX is used), skip
  if (bboxFilteredPoints.length === 0) {
    console.log('chunkIndex', chunkIndex)
    writeChunk()
    if (chunkIndex === BBOX_CHUNKS.length - 1) {
      done()
    } else {
      chunkIndex++
      execBBoxChunk()
    }
    return
  }

  const pb = progressBar(bboxFilteredPoints.length)

  bboxFilteredPoints.forEach((point) => {
    pb.increment()

    const layoutedId = point.properties.layouted_id
    const islandMeta = islandsMeta[layoutedId]
    const island_id = islandMeta.island_id

    if (point.properties.is_cluster === true) {
      const cluster = point
      numClustersTried++
      const clusterChildren = points.features.filter(
        (f) =>
          f.properties.is_cluster === false &&
          f.properties.cluster_id === layoutedId
      )

      const scale = islandMeta.layoutScale
      const islandMrct = baseIslandsMrct.features.find(
        (i) => i.properties.island_id === island_id
      )
      const clusterCenterMrct = turf.toMercator(cluster)
      const islandMrctTransposed = transposeAndScale(
        clusterCenterMrct,
        islandMrct,
        scale
      )
      const island = turf.toWgs84(islandMrctTransposed)

      const clusterWeights = clusterChildren.map(
        (c) => 1 + 0.5 * Math.sqrt(c.properties.layoutPriorityScore)
      )
      // console.log(clusterWeights)
      // console.log( clusterChildren.map(c => c.properties.author_id))
      let resultPromise
      let syncResult
      if (USE_WORKERS !== true) {
        syncResult = tryGetTerritories(
          cluster,
          clusterChildren,
          island,
          clusterWeights
        )
      } else {
        resultPromise = pool.exec('tryGetTerritories', [
          cluster,
          clusterChildren,
          island,
          clusterWeights
        ])
      }
      (
        resultPromise ||
        new Promise((resolve) => {
          resolve(syncResult)
        })
      )
        .then((result) => {
          // territories suceeded, add to polygon and lines arrays,
          // and in final meta as cluster
          if (result && !result.error) {
            console.log(
              'Success for',
              cluster.properties.layouted_id,
              cluster.properties.cluster_point_count
            )
            const { lines, polygons } = result
            polygons.forEach((territory, i) => {
              territory.properties = {
                cluster_id: layoutedId,
                layouted_id: clusterChildren[i].properties.layouted_id,
                author_id: clusterChildren[i].properties.author_id
              }
              territoriesPolygons.push(territory)
            })
            lines.forEach((territoryLines) => {
              territoriesLines.push(territoryLines)
            })
            finalMeta.push({
              layouted_id: layoutedId,
              is_cluster: true,
              island_id,
              scale: islandMeta.layoutScale,
              error: islandMeta.error,
              center: cluster.geometry.coordinates
            })
            numClustersSucceeded++
          }
          // territories failed, do not add to polygon and lines arrays,
          // and add cluster children in meta instead of cluster
          else {
            console.log(
              'Failed for',
              cluster.properties.layouted_id,
              cluster.properties.cluster_point_count,
              result.error
            )
            clusterChildren.forEach((clusterChild) => {
              const clusterChildLayoutedId = clusterChild.properties.layouted_id
              const clusterChildIslandMeta = islandsMeta[clusterChildLayoutedId]
              if (clusterChildIslandMeta) {
                finalMeta.push({
                  layouted_id: clusterChildLayoutedId,
                  is_cluster: false,
                  cluster_failed: true,
                  island_id: clusterChildIslandMeta.island_id,
                  scale: clusterChildIslandMeta.layoutScale,
                  error: clusterChildIslandMeta.error,
                  center: clusterChild.geometry.coordinates
                })
              }
            })
          }

          numFeatures++
          console.log(numFeatures, bboxFilteredPoints.length)
          // TODO review if this is needed for all BBOXs
          if (numFeatures === bboxFilteredPoints.length -1) {
            console.log(chunkIndex, BBOX_CHUNKS.length - 1)
            pool.terminate()
            pb.stop()
            writeChunk()
            if (chunkIndex === BBOX_CHUNKS.length - 1) {
              done()
            } else {
              chunkIndex++
              execBBoxChunk()
            }
          }
        })
        .catch(function(err) {
          console.error(err)
        })
    }
    // It's not a cluster - don't do territories and add it "as is" to final meta
    else {
      finalMeta.push({
        layouted_id: layoutedId,
        is_cluster: false,
        island_id,
        scale: islandMeta.layoutScale,
        error: islandMeta.error,
        center: point.geometry.coordinates,
        author_id: point.properties.author_id
      })
      numFeatures++
    }
  })
}

execBBoxChunk()
