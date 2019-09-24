#!/usr/bin/env node

const fs = require('fs')
const _ = require('lodash')
const turf = require('@turf/turf')
const Supercluster = require('supercluster')
const avg = require('../util/avg')
const progressBar = require('../util/progressBar')

const { AUTHORS, UMAP_GEO, CLUSTER_POINTS, CLUSTERS } = require('../constants')

const umap = JSON.parse(fs.readFileSync(UMAP_GEO, 'utf-8'))
const authors = JSON.parse(fs.readFileSync(AUTHORS, 'utf-8'))

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

const pb = progressBar(clusters.length)
clusters = clusters.map(cluster => {
  pb.increment()
  const [r,g,b] = rdCol()

  const properties = {...cluster.properties}
  if (cluster.properties.cluster_id) {
    const children = index.getChildren(cluster.properties.cluster_id).map(l => l.properties.id)
    const childrenProps = []
    children.forEach(id => {
      featuresDict[id].properties.cluster_id = cluster.properties.cluster_id
      featuresDict[id].properties.r = r
      featuresDict[id].properties.g = g
      featuresDict[id].properties.b = b

      const author = authors.find(a => a.id === id)
      if (!author) {
        featuresDict[id].properties.author_error = true
        console.log('cant find author', id)
      } else {
        featuresDict[id].properties.sum_popularity = author.sum_popularity
        featuresDict[id].properties.avg_popularity = author.avg_popularity
        featuresDict[id].properties.books_count = author.books_count
      }
      childrenProps.push(featuresDict[id].properties)
    })
    properties.children = children
    properties.sum_popularity = _.sumBy(childrenProps, a => a.sum_popularity)
    properties.avg_popularity = avg(childrenProps.map(a => a.sum_popularity))
    properties.books_count = _.sumBy(childrenProps, a => a.books_count)
  } else {
    const cluster_id = cluster.properties.id
    properties.children = [cluster_id]
    properties.point_count = 1
    const author = authors.find(a => a.id === cluster_id)
    properties.sum_popularity = author.sum_popularity
    properties.avg_popularity = author.avg_popularity
    properties.books_count = author.books_count
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

const clusterPoints = Object.keys(featuresDict).map(id => {
  const feature = featuresDict[id]
  return feature
})

fs.writeFileSync(CLUSTER_POINTS, JSON.stringify(turf.featureCollection(clusterPoints)))
fs.writeFileSync(CLUSTERS, JSON.stringify(turf.featureCollection(clusters)))
console.log('Wrote ', CLUSTER_POINTS)
console.log('Wrote ', CLUSTERS)