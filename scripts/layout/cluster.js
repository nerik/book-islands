#!/usr/bin/env node

const fs = require('fs')
const _ = require('lodash')
const Supercluster = require('supercluster')

const { UMAP_GEO, UMAP_GEO_CLUSTER, CLUSTERS } = require('../constants')

const umap = JSON.parse(fs.readFileSync(UMAP_GEO, 'utf-8'))

const minX = _.minBy(umap.features, d => d.geometry.coordinates[0]).geometry.coordinates[0]
const maxX = _.maxBy(umap.features, d => d.geometry.coordinates[0]).geometry.coordinates[0]
const minY = _.minBy(umap.features, d => d.geometry.coordinates[1]).geometry.coordinates[1]
const maxY = _.maxBy(umap.features, d => d.geometry.coordinates[1]).geometry.coordinates[1]


const index = new Supercluster({
  radius: 150,
  minZoom: 8,
  maxZoom: 8
})
index.load(umap.features)
let clusters = index.getClusters([minX, minY, maxX, maxY], 2)
console.log('Created ', clusters.length, 'clusters')

const featuresDict = {}
umap.features.forEach(feature => {
  featuresDict[feature.properties.id] = feature
})

const NUM_COLORS = 100
const rdChan = () => Math.floor(Math.random() * 255)
const colors = Array.from(Array(NUM_COLORS)).map(() => [rdChan(),rdChan(),rdChan()])
const rdCol = () => colors[Math.floor(Math.random() * NUM_COLORS)]

clusters = clusters.map(cluster => {  
  const [r,g,b] = rdCol()

  const properties = {...cluster.properties}
  if (cluster.properties.cluster_id) {
    const children = index.getChildren(cluster.properties.cluster_id).map(l => l.properties.id)
    children.forEach(id => {
      featuresDict[id].properties.cluster_id = cluster.properties.cluster_id
      featuresDict[id].properties.r = r
      featuresDict[id].properties.g = g
      featuresDict[id].properties.b = b
    })
    properties.children = children
  } else {
    const cluster_id = cluster.properties.id
    properties.children = [cluster_id]
    properties.point_count = 1
    properties.cluster_id = featuresDict[cluster_id].properties.cluster_id = cluster.properties.id
  }

  return {
    ...cluster,
    properties: {
      ...properties,
      r,
      g,
      b
    }
  }
})

const features = Object.keys(featuresDict).map(id => {
  const feature = featuresDict[id]
  return feature
})

const geoJSON = {
  'type': 'FeatureCollection',
  features
}

fs.writeFileSync(UMAP_GEO_CLUSTER, JSON.stringify(geoJSON))

const clustersGeoJSON = {
  'type': 'FeatureCollection',
  features: clusters
}

fs.writeFileSync(CLUSTERS, JSON.stringify(clustersGeoJSON))