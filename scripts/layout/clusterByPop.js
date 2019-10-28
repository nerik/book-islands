#!/usr/bin/env node

const fs = require('fs')
const turf = require('@turf/turf')
const _ = require('lodash')
const getAuthorLayoutPriority = require('../util/getAuthorLayoutPriority')

const { AUTHORS, UMAP_GEO, CLUSTERS } = require('../constants')

const features = JSON.parse(fs.readFileSync(UMAP_GEO, 'utf-8')).features
const authors = JSON.parse(fs.readFileSync(AUTHORS, 'utf-8'))

const authorDict = {}
authors.forEach(author => {
  authorDict[author.id] = author
})

const orderedFeatures = features.map(feature => {
  const authorId = feature.properties.id
  const author = authorDict[authorId]
  if (!author) {
    console.log('Author exist in UMAP but not in DB:', authorId)
    return null
  }
  return {
    ...feature,
    properties: {
      ...feature.properties,
      ...author,
      priority: getAuthorLayoutPriority(author)
    }
  }
})
  .filter(f => f !== null)
  .map(feature => {
    // if feature priority is higher than the threshold, mark it as cluster
    if (feature.properties.priority > 20) {
      // generate a cluster radius:
      // squareroot this fucker to avoid a very big Shakespeare cluster and account
      // for radius/circle area relation)
      const radius = 5 * Math.sqrt(Math.sqrt(feature.properties.priority))
      return {
        ...feature,
        properties: {
          ...feature.properties,
          is_cluster: true,
          radius
        }
      }
    }
    return feature
  })
  .sort((a, b) => {
    return a.priority - b.priority
  })


const clusters = orderedFeatures.filter(f => f.properties.is_cluster === true)
console.log(clusters.length, 'clusters in first pass')


// Merge clusters that are touching, ie their center to center distance is less
// than the sum of their radii. 
// Start by collecting neighbors
const allNeighborsIds = []
clusters.forEach(cluster => {
  let neighborsIds
  clusters.forEach(overlappingCluster => {
    if (cluster.properties.id === overlappingCluster.properties.id) {
      return
    }
    const d = turf.distance(cluster, overlappingCluster)
    if (d < cluster.properties.radius + overlappingCluster.properties.radius) {
      if (!neighborsIds) {
        neighborsIds = [cluster.properties.id]
      }
      neighborsIds.push(overlappingCluster.properties.id)
    }
  })
  if (neighborsIds) {
    allNeighborsIds.push(neighborsIds)
  }
})

// Merge neighbors into clusters
const allMergedIds = []
allNeighborsIds.forEach(neighborsIds => {
  for (let i = 0; i < allMergedIds.length; i++) {
    const mergedIds = allMergedIds[i]
    if (_.intersection(neighborsIds, mergedIds).length) {
      allMergedIds[i] = _.uniq(allMergedIds[i].concat(neighborsIds))
      return
    }
  }
  allMergedIds.push(neighborsIds)
})


console.log(allMergedIds)



const p = 'out/layout/clustersByPop_buffers.geo.json'
fs.writeFileSync(p, JSON.stringify(turf.featureCollection(buffers)))
console.log('Wrote ', p)