#!/usr/bin/env node

const fs = require('fs')
const _ = require('lodash')
const d3Arr = require('d3-array')
const turf = require('@turf/turf')
const Supercluster = require('supercluster')
const avg = require('../util/avg')

const { AUTHORS, UMAP_GEO, CLUSTERS } = require('../constants')

const umap = JSON.parse(fs.readFileSync(UMAP_GEO, 'utf-8'))
const authors = JSON.parse(fs.readFileSync(AUTHORS, 'utf-8'))

const minX = _.minBy(umap.features, (d) => d.geometry.coordinates[0]).geometry.coordinates[0]
const maxX = _.maxBy(umap.features, (d) => d.geometry.coordinates[0]).geometry.coordinates[0]
const minY = _.minBy(umap.features, (d) => d.geometry.coordinates[1]).geometry.coordinates[1]
const maxY = _.maxBy(umap.features, (d) => d.geometry.coordinates[1]).geometry.coordinates[1]

const bbox = [minX, minY, maxX, maxY]
console.log('UMAP bbox', bbox)

//  -------  Initial pass: generate very tight clusters (usually 2-3 points)
const initialIndex = new Supercluster({
  radius: 0.25,
  maxZoom: 18,
})
initialIndex.load(umap.features)

const initialClustersWithNoise = initialIndex.getClusters(bbox, 2)

// remove noise for consideration in meta pass
const initialClustersWithoutNoise = initialClustersWithNoise.filter((c) => c.properties.cluster_id)

// get initial pass leaves
const initialClusters = initialClustersWithoutNoise.map((cluster) => {
  const initialClusterId = cluster.properties.cluster_id
  return {
    ...cluster,
    properties: {
      initialClusterId: cluster.properties.cluster_id,
      initialLeaves: initialIndex.getLeaves(initialClusterId, Infinity).map((l) => l.properties.id),
      cluster_id: undefined,
    },
  }
})

console.log('Initial pass: generated ', initialClusters.length, ' clusters')
console.log(
  'Initial pass: ',
  initialClustersWithNoise.length - initialClusters.length,
  ' points left alone'
)
console.log(
  'Initial pass mean pts per cluster: ',
  d3Arr.mean(initialClusters.map((c) => c.properties.initialLeaves.length))
)

// ------- Meta pass: make cluster of clusters with wider radius
const metaIndex = new Supercluster({
  radius: 1,
  maxZoom: 18,
})
metaIndex.load(initialClusters)
const metaClustersWithNoise = metaIndex.getClusters(bbox, 2)

const rdChan = () => Math.floor(Math.random() * 255)
const rdCol = () => [rdChan(), rdChan(), rdChan()]

const metaClusters = metaClustersWithNoise.map((metaCluster) => {
  const metaClusterId = metaCluster.properties.cluster_id
  const [cluster_r, cluster_g, cluster_b] = rdCol()
  let cluster_id
  let cluster_leaves
  if (metaClusterId === undefined) {
    const initialClusterId = metaCluster.properties.initialClusterId
    cluster_id = `i_${initialClusterId}`
    cluster_leaves = initialClusters.find((c) => c.properties.initialClusterId === initialClusterId)
      .properties.initialLeaves
  } else {
    const allInitialLeaves = metaIndex.getLeaves(metaClusterId, Infinity).map((metaLeaf) => {
      const initialClusterId = metaLeaf.properties.initialClusterId
      if (initialClusterId === undefined) {
        return [metaLeaf.properties.id]
      }
      const firstCluster = initialClusters.find(
        (c) => c.properties.initialClusterId === initialClusterId
      )
      return firstCluster.properties.initialLeaves
    })
    cluster_id = metaClusterId
    cluster_leaves = _.flatten(allInitialLeaves)
  }
  return {
    ...metaCluster,
    properties: {
      is_cluster: true,
      cluster_id,
      layouted_id: `c_${cluster_id}`,
      cluster_point_count: cluster_leaves.length,
      cluster_leaves,
      cluster_r,
      cluster_g,
      cluster_b,
    },
  }
})

console.log('Meta pass: generated ', metaClusters.length, ' clusters')
console.log(
  'Meta pass mean pts per cluster: ',
  d3Arr.mean(metaClusters.map((c) => c.properties.cluster_leaves.length))
)

// ----- attach cluster to umap features
const featuresDict = {}
umap.features.forEach((feature) => {
  featuresDict[feature.properties.id] = feature
})

metaClusters.forEach((cluster) => {
  cluster.properties.cluster_leaves.forEach((leaf) => {
    const id = leaf
    featuresDict[id].properties.is_cluster = false
    featuresDict[id].properties.layouted_id = `pc_${id}`
    featuresDict[id].properties.cluster_id = cluster.properties.cluster_id
    featuresDict[id].properties.cluster_r = cluster.properties.cluster_r
    featuresDict[id].properties.cluster_g = cluster.properties.cluster_g
    featuresDict[id].properties.cluster_b = cluster.properties.cluster_b
  })
})

// prepare standalone points
let clusterPoints = Object.keys(featuresDict).map((id) => {
  const feature = featuresDict[id]
  if (!feature.properties.cluster_id) {
    const id = feature.properties.id
    feature.properties.is_cluster = false
    feature.properties.layouted_id = `ps_${id}`
    feature.properties.cluster_r = 100
    feature.properties.cluster_g = 100
    feature.properties.cluster_b = 100
  }
  return feature
})

// retrieve authors
const authorDict = {}
authors.forEach((author) => {
  authorDict[author.id] = author
})

clusterPoints = clusterPoints.map((pt) => {
  const author = authorDict[pt.properties.id]
  if (!author) {
    pt.properties.author_error = true
    console.log('cant find author', pt.properties.id)
  } else {
    pt.properties.sum_popularity = author.sum_popularity
    pt.properties.avg_popularity = author.avg_popularity
    pt.properties.books_count = author.books_count
  }
  return pt
})

// Compute per-cluster stats
metaClusters.forEach((cluster) => {
  const childrenProps = cluster.properties.cluster_leaves.map((id) => {
    return featuresDict[id].properties
  })
  cluster.properties.sum_popularity = _.sumBy(childrenProps, (a) => a.sum_popularity)
  cluster.properties.avg_popularity = avg(childrenProps.map((a) => a.sum_popularity))
  cluster.properties.books_count = _.sumBy(childrenProps, (a) => a.books_count)
})

const merged = clusterPoints.concat(metaClusters)

fs.writeFileSync(CLUSTERS, JSON.stringify(turf.featureCollection(merged)))
console.log('Wrote ', CLUSTERS)
