#!/usr/bin/env node
const fs = require('fs')
const turf = require('@turf/turf')
const workerpool = require('workerpool')  
const progressBar = require('../util/progressBar')
const pointWithinBBox = require('../util/pointWithinBBox')



const {
  CLUSTERS, ISLANDS_CANDIDATES_META, BASE_ISLANDS_LOWDEF_MRCT,
  TERRITORY_LINES, TERRITORY_POLYGONS, ISLANDS_FINAL_META,
  TEST_BBOX, BBOX_CHUNKS
} = require('../constants')

const clusters = JSON.parse(fs.readFileSync(CLUSTERS, 'utf-8'))
const baseIslandsMrct = JSON.parse(fs.readFileSync(BASE_ISLANDS_LOWDEF_MRCT, 'utf-8'))

const filteredClusters = clusters.features
  .filter(cluster =>
    cluster.geometry.coordinates[0] > TEST_BBOX.minX &&
    cluster.geometry.coordinates[0] < TEST_BBOX.maxX &&
    cluster.geometry.coordinates[1] > TEST_BBOX.minY &&
    cluster.geometry.coordinates[1] < TEST_BBOX.maxY
  )
// Remove clustered points (but keep clusters + standalone points)
  .filter(cluster => {
    return cluster.properties.is_cluster === true || cluster.properties.cluster_id === undefined
  })

console.log('Will try to do territories for:', filteredClusters.length, 'clustered')


const poolPath = __dirname + '/util/territoryWorker.js'
let chunkIndex = 0

const done = () => {
  console.log('done.')
}

const execChunk = () => {
  const bboxChunk = BBOX_CHUNKS[chunkIndex]
  console.log('Current chunk:', bboxChunk, chunkIndex)
  const bboxFilteredClusters = filteredClusters
    .filter(cluster => {
      return (pointWithinBBox(cluster, bboxChunk))
    })

  const islandsMetaPath = ISLANDS_CANDIDATES_META.replace('.json', `_${chunkIndex}.json`)
  const islandsMeta = JSON.parse(fs.readFileSync(islandsMetaPath, 'utf-8'))
  
  console.log('For chunk:', bboxFilteredClusters.length)


  const pool = workerpool.pool(poolPath)
  let numClustersTried = 0
  let numClustersSucceeded = 0
  let numFeatures = 0

  const territoriesLines = []
  const territoriesPolygons = []

  const finalMeta = []

  const writeChunk = () => {
    console.log(chunkIndex)
    console.log('Cluster success: ', numClustersSucceeded, '/', numClustersTried)
    console.log('Created ', territoriesPolygons.length, 'territories')
  
    const territoryPolygonsPath = TERRITORY_POLYGONS.replace('.geo.json', `_${chunkIndex}.geo.json`)
    const territoryLinesPath = TERRITORY_LINES.replace('.geo.json', `_${chunkIndex}.geo.json`)
    fs.writeFileSync(territoryPolygonsPath, JSON.stringify(turf.featureCollection(territoriesPolygons)))
    fs.writeFileSync(territoryLinesPath, JSON.stringify(turf.featureCollection(territoriesLines)))
    console.log ('Wrote', territoryPolygonsPath)
    console.log ('Wrote', territoryLinesPath)
  
    const finalMetaPath = ISLANDS_FINAL_META.replace('.json', `_${chunkIndex}.json`)
    fs.writeFileSync(finalMetaPath, JSON.stringify(finalMeta))
    console.log ('Wrote', finalMetaPath)
  }




  // when bbox is empty (because TEST_BBOX is used), skip
  if (bboxFilteredClusters.length === 0) {
    if (chunkIndex === BBOX_CHUNKS.length - 1) {
      done()
    } else {
      writeChunk()
      chunkIndex++
      execChunk()
    }
    return
  }

  const pb = progressBar(bboxFilteredClusters.length)

  bboxFilteredClusters.forEach(cluster => {
    pb.increment()

    const layoutedId = cluster.properties.layouted_id
    const clusterId = cluster.properties.cluster_id
    const islandMeta = islandsMeta[layoutedId]
    const clusterIslandId = islandMeta.island_id

    if (cluster.properties.is_cluster === true) {
      numClustersTried++
      const clusterChildren = clusters.features
        .filter(f => f.properties.is_cluster === false && f.properties.cluster_id === clusterId)

      const islandMrct = baseIslandsMrct.features.find(i => i.properties.island_id === clusterIslandId)
      pool.exec('getTerritories', [cluster, clusterChildren, islandMrct, islandMeta.layoutScale])
        .then((result) => {
          // territories suceeded, add to polygon and lines arrays, 
          // and in final meta as cluster
          if (result) {
            const {lines, polygons} = result
            polygons.forEach((territory, i) => {
              territory.properties = {
                cluster_layouted_id: layoutedId,
                author_id: clusterChildren[i].properties.id,
                // cluster_r: clusterPoints[i].properties.cluster_r,
                // cluster_g: clusterPoints[i].properties.cluster_g,
                // cluster_b: clusterPoints[i].properties.cluster_b,
              }
              territoriesPolygons.push(territory)
            })
            lines.forEach((territoryLines) => {
              territoriesLines.push(territoryLines)
            })
            finalMeta.push({
              layouted_id: layoutedId,
              is_cluster: true,
              island_id: clusterIslandId,
              scale: islandMeta.layoutScale,
              error: islandMeta.error,
              center: cluster.geometry.coordinates
            })
            numClustersSucceeded++
          }
          // territories failed, do not add to polygon and lines arrays,
          // and add cluster children in meta instead of cluster
          else {
            clusterChildren.forEach(clusterChild => {
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
                  center: clusterChild.geometry.coordinates,
                })
              }
            })
          }

          numFeatures++
          console.log(numFeatures, bboxFilteredClusters.length)
          if (numFeatures === bboxFilteredClusters.length) {
            console.log(chunkIndex, BBOX_CHUNKS.length - 1)
            pool.terminate()
            pb.stop()
            writeChunk()
            if (chunkIndex === BBOX_CHUNKS.length - 1) {
              done()
            } else {
              chunkIndex++
              execChunk()
            }
          }

        })
        .catch(function (err) {
          console.error(err)
        })
    }
    // It's not a cluster - don't do territories and add it as is to final meta
    else {
      finalMeta.push({
        layouted_id: layoutedId,
        is_cluster: false,
        island_id: clusterIslandId,
        scale: islandMeta.layoutScale,
        error: islandMeta.error,
        center: cluster.geometry.coordinates,
      })
      numFeatures++
    }
  })
}

execChunk()