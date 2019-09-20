#!/usr/bin/env node

const fs = require('fs')
const turf = require('@turf/turf')
const _ = require('lodash')
const {scale, rotate, translate, compose, applyToPoints} = require('transformation-matrix')
const progressBar = require('../util/progressBar')

const { UMAP_GEO_CLUSTER, CLUSTERS, BASE_ISLANDS_LOWDEF, TEST_BBOX } = require('../constants')

const baseIslands = JSON.parse(fs.readFileSync(BASE_ISLANDS_LOWDEF, 'utf-8'))
const umap = JSON.parse(fs.readFileSync(UMAP_GEO_CLUSTER, 'utf-8'))
const clusters = JSON.parse(fs.readFileSync(CLUSTERS, 'utf-8'))

// TODO move to base island gen?
const baseIslandsMrct = baseIslands.features.map(island => {
  const mrct = turf.toMercator(island)
  const mrctCenter = turf.coordAll(turf.toMercator(turf.point(island.properties.center)))[0]
  mrct.properties.center = mrctCenter
  return mrct
})

const testFeatures = []

const filteredClusters = clusters.features
// .filter(cluster => cluster.properties.point_count > 1)
  .filter(
    cluster => 
      cluster.geometry.coordinates[0] > TEST_BBOX.minX &&
    cluster.geometry.coordinates[0] < TEST_BBOX.maxX &&
    cluster.geometry.coordinates[1] > TEST_BBOX.minY &&
    cluster.geometry.coordinates[1] < TEST_BBOX.maxY
  )


const pb = progressBar(filteredClusters.length)
filteredClusters.forEach(cluster => {
  // 1. Get center of cluster
  // 2. Transpose island so that cluster center = island center of mass
  // 3. All cluster points fit?
  const allClusterPoints = umap.features.filter(p => p.properties.cluster_id === cluster.properties.cluster_id)
  const allClusterPointsFeature = turf.featureCollection(allClusterPoints)
  // baseIslandsMrct.forEach(baseIslandMrct => {

  // })
  const islandMrct = _.cloneDeep(baseIslandsMrct[Math.floor(Math.random() * baseIslandsMrct.length)])
  const clusterCenterMrct = turf.toMercator(cluster)

  // latest transformations apply first
  const matrix = compose(
    // translate to target center
    translate(clusterCenterMrct.geometry.coordinates[0], clusterCenterMrct.geometry.coordinates[1]),
    // apply transformation(s)
    scale(.2, .2),
    // translate to map origin
    translate(-islandMrct.properties.center[0], -islandMrct.properties.center[1]),
  )

  // TODO that [0] wont work with multipolygons
  islandMrct.geometry.coordinates[0] = applyToPoints(matrix, islandMrct.geometry.coordinates[0])
  const island = turf.toWgs84(islandMrct)
  island.properties.r = cluster.properties.r
  island.properties.g = cluster.properties.g
  island.properties.b = cluster.properties.b

  if (turf.pointsWithinPolygon(allClusterPointsFeature, island).features.length) {
    testFeatures.push(island)
  }

  // const points = umap.features.filter(f => f.properties.cluster_id === cluster.properties.cluster_id)

  pb.increment()
})

pb.stop()

console.log('Gave scores to ', testFeatures.length, ' features')

const geoJSON = {
  'type': 'FeatureCollection',
  features: testFeatures
}

fs.writeFileSync('out/layout/testIslands.geo.json', JSON.stringify(geoJSON))