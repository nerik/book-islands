#!/usr/bin/env node
const fs = require('fs')
const turf = require('@turf/turf')
const progressBar = require('../util/progressBar')
const getClusterTerritories = require('./util/getClusterTerritories')
const transposeAndScale = require('../util/transposeAndScale')
const pointWithinBBox = require('../util/pointWithinBBox')


const {
  CLUSTERS, ISLANDS_CANDIDATES_META, BASE_ISLANDS_LOWDEF_MRCT,
  TERRITORY_LINES, TERRITORY_POLYGONS, ISLANDS_FINAL_META,
  TEST_BBOX, BBOX_CHUNKS
} = require('../constants')

const clusters = JSON.parse(fs.readFileSync(CLUSTERS, 'utf-8'))
const baseIslandsMrct = JSON.parse(fs.readFileSync(BASE_ISLANDS_LOWDEF_MRCT, 'utf-8'))

const baseIslandsDict = {}
baseIslandsMrct.features.forEach(island => {
  const id = island.properties.island_id
  baseIslandsDict[id] = island
})

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
  // Remove errors
  // .filter(cluster => {
  //   const layouted_id = cluster.properties.layouted_id
  //   const meta = islandsMeta[layouted_id]
  //   if (/*!meta || */meta.error) {
  //     return false
  //   }
  //   return true
  // })

console.log('Will try to do territories for:', filteredClusters.length, 'clustered')

BBOX_CHUNKS.forEach((bboxChunk, chunkIndex) => {
  // if (chunkIndex >= 2) {
  //   return
  // }
  console.log('Current chunk:', bboxChunk, chunkIndex)
  const bboxFilteredClusters = filteredClusters
    .filter(cluster => {
      return (pointWithinBBox(cluster, bboxChunk))
    })

  const islandsMetaPath = ISLANDS_CANDIDATES_META.replace('.json', `_${chunkIndex}.json`)
  const islandsMeta = JSON.parse(fs.readFileSync(islandsMetaPath, 'utf-8'))

  let numClustersTried = 0
  let numClustersSucceeded = 0
  
  const territoriesLines = []
  const territoriesPolygons = []

  const finalMeta = []
  
  console.log('For chunk:', bboxFilteredClusters.length)
  const pb = progressBar(bboxFilteredClusters.length)

  bboxFilteredClusters.forEach(cluster => {
    pb.increment()
    const layoutedId = cluster.properties.layouted_id
    const islandMeta = islandsMeta[layoutedId]
    const clusterIslandId = islandMeta.island_id
    const clusterId = cluster.properties.cluster_id

    if (cluster.properties.is_cluster === true) {
        
      // get children of cluster point
      const clusterChildren = clusters.features
        .filter(f => f.properties.is_cluster === false && f.properties.cluster_id === clusterId)

      const islandMrct = baseIslandsMrct.features.find(i => i.properties.island_id === clusterIslandId)
      const clusterCenterMrct = turf.toMercator(cluster)
      const islandMrctTransposed = transposeAndScale(clusterCenterMrct, islandMrct, islandMeta.layoutScale)
      const island = turf.toWgs84(islandMrctTransposed)

      // TODO for now just generate "dirty" territories ovelapping islands
      // will then have to generate "borders"
      // TODO generate real weights
      const clusterWeights = clusterChildren.map(p => 1)
      // console.log('Clustering:', numClustersTried, '/', numClusters)
      const NUM_TRIES = 1
      let succeeded = false
      for (let i = 0; i < NUM_TRIES; i++) {
        try {
          const {lines, polygons} = getClusterTerritories(clusterChildren, clusterWeights, island)
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
          succeeded = true
          break
        } catch (e) {
          console.log(e.message)
          console.log('failed')
        }
      }
      if (succeeded === true) {
        numClustersSucceeded++
        console.log('succeeded for', layoutedId)
        finalMeta.push({
          layouted_id: layoutedId,
          is_cluster: true,
          island_id: clusterIslandId,
          scale: islandMeta.layoutScale,
          error: islandMeta.error,
          center: cluster.geometry.coordinates
        })
      } else {
        console.log('failed for', layoutedId)
        clusterChildren.forEach(clusterChild => {
          const clusterChildLayoutedId = clusterChild.properties.layouted_id
          const clusterChildIslandMeta = islandsMeta[clusterChildLayoutedId]
          finalMeta.push({
            layouted_id: clusterChildLayoutedId,
            is_cluster: false,
            cluster_failed: true,
            island_id: clusterChildIslandMeta.island_id,
            scale: clusterChildIslandMeta.layoutScale,
            error: clusterChildIslandMeta.error,
            center: clusterChild.geometry.coordinates,
          })
        })
      }
      console.log('-----')
      numClustersTried++

    } else {
      // standalone islands: simply copy over meta
      finalMeta.push({
        layouted_id: layoutedId,
        is_cluster: false,
        island_id: clusterIslandId,
        scale: islandMeta.layoutScale,
        error: islandMeta.error,
        center: cluster.geometry.coordinates,
      })
    }
  })
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
  
})
