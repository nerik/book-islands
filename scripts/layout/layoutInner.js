#!/usr/bin/env node


// First just with random coastal cities

const fs = require('fs')

const { CLUSTERS, ISLANDS_META, ISLANDS_LOWDEF, TEST_BBOX } = require('../constants')

const islands = JSON.parse(fs.readFileSync(ISLANDS_LOWDEF, 'utf-8'))
const islandsMeta = JSON.parse(fs.readFileSync(ISLANDS_META, 'utf-8'))
const clusters = JSON.parse(fs.readFileSync(CLUSTERS, 'utf-8'))

const islandsDict = {}
islands.features.forEach(island => {
  const id = island.properties.layouted_id
  islandsDict[id] = island
})

const filteredClusters = clusters.features
  .filter(
    cluster => 
      cluster.geometry.coordinates[0] > TEST_BBOX.minX &&
  cluster.geometry.coordinates[0] < TEST_BBOX.maxX &&
  cluster.geometry.coordinates[1] > TEST_BBOX.minY &&
  cluster.geometry.coordinates[1] < TEST_BBOX.maxY
  )

// First just with single point islands
// .filter(cluster => {
//   return cluster.properties.cluster_id === undefined
// })
// Remove clusters that somehow don't have meta
// .filter(cluster => {
//   const layouted_id = cluster.properties.layouted_id
//   const meta = islandsMeta[layouted_id]
//   return meta
// })
// // // Remove clusters that somehow don't have island
// .filter(cluster => {
//   const layouted_id = cluster.properties.layouted_id
//   const island = islandsDict[layouted_id]
//   return island
// })

console.log('Will do inner layout for:', filteredClusters.length)

filteredClusters.forEach(cluster => {
  const layouted_id = cluster.properties.layouted_id
  const meta = islandsMeta[layouted_id]
  const island = islandsDict[layouted_id]
  // console.log(layouted_id, meta, island)

})
  