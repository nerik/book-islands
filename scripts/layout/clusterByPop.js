#!/usr/bin/env node

const fs = require('fs')
const turf = require('@turf/turf')
const _ = require('lodash')
const getAuthorLayoutPriority = require('../util/getAuthorLayoutPriority')
const avg = require('../util/avg')

const { AUTHORS, UMAP_GEO, CLUSTERS } = require('../constants')

// overall cluster size (ie radius of the circle which will contain cluster children)
const CLUSTER_RADIUS_MULT = 5
// minimum priority value to form a cluster (priority is computed from author score, see getAuthorLayoutPriority)
const MIN_CLUSTER_PRIORITY = 10 
// TODO We might want to have these values depend on the archipel the potential cluster will belong

const features = JSON.parse(fs.readFileSync(UMAP_GEO, 'utf-8')).features
const authors = JSON.parse(fs.readFileSync(AUTHORS, 'utf-8'))

const authorDict = {}
authors.forEach(author => {
  authorDict[author.id] = author
})

const authorsInUmapNotInDB = []
const orderedFeatures = features.map(feature => {
  const authorId = feature.properties.id
  const author = authorDict[authorId]
  if (!author) {
    authorsInUmapNotInDB.push(authorId)
    // console.log('Author exist in UMAP but not in DB:', authorId)
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
    if (feature.properties.priority > MIN_CLUSTER_PRIORITY) {
      // generate a cluster radius:
      // squareroot this fucker to avoid a very big Shakespeare cluster and account
      // for radius/circle area relation)
      const radius = CLUSTER_RADIUS_MULT * Math.sqrt(Math.sqrt(feature.properties.priority))
      return {
        ...feature,
        properties: {
          ...feature.properties,
          will_cluster: true,
        },
        radius
      }
    }
    return feature
  })

orderedFeatures.sort((a, b) => {
  return b.properties.priority - a.properties.priority
})

console.log(authorsInUmapNotInDB.length, 'authors are in umap output but not in DB')

const clusters = orderedFeatures.filter(f => f.properties.will_cluster === true)
console.log(clusters.length, 'clusters in first pass with a total of', orderedFeatures.length, 'points')


// Prepare Final clusters
const rdChan = () => Math.floor(Math.random() * 255)
const rdCol = () => [rdChan(),rdChan(),rdChan()]
let finalClusters = clusters.map(cluster => {
  const [cluster_r,cluster_g,cluster_b] = rdCol()
  const feature = {
    ...cluster,
    properties: {
      is_cluster: true,
      layouted_id: `cluster_${cluster.properties.id}`,
      cluster_r,
      cluster_g,
      cluster_b,
    },
    radius: cluster.radius
  }
  return feature
})


// Attach standalone leaves to clusters
const finalStandalonePoints = orderedFeatures.map(point => {
  const properties = {
    is_cluster: false
  }
  const closestCluster = _.minBy(finalClusters, (cluster) => {
    const dist = turf.distance(cluster, point)
    const inCluster = dist < cluster.radius
    return (inCluster) ? dist : null
  })

  if (closestCluster === undefined) {
    properties.layouted_id = `standalone_${point.properties.id}`
    properties.cluster_r = 100
    properties.cluster_g = 100
    properties.cluster_b = 100
  } else {
    properties.layouted_id = `clustered_${point.properties.id}`
    properties.cluster_id = closestCluster.properties.layouted_id
    properties.cluster_r = closestCluster.properties.cluster_r
    properties.cluster_g = closestCluster.properties.cluster_g
    properties.cluster_b = closestCluster.properties.cluster_b
    // console.log(properties, parentCluster)
  }
  return {
    ...point,
    properties: {
      ...properties,
      sum_popularity: point.properties.sum_popularity,
      avg_popularity: point.properties.avg_popularity,
      books_count: point.properties.books_count,
    }
  }
})

const clusteredPoints = finalStandalonePoints.filter(point => point.properties.cluster_id !== undefined)

finalClusters = finalClusters.map(cluster => {
  const children = clusteredPoints
    .filter(clusteredPoint => {
      return clusteredPoint.properties.cluster_id === cluster.properties.layouted_id
    })
  return {
    ...cluster,
    children
  }
})


// Remove non viable (0/1-point) clusters
finalClusters = finalClusters.filter(cluster => {
  const clusterChildren = cluster.children
  if (clusterChildren.length === 1) {
    delete clusterChildren[0].properties.cluster_id
    clusterChildren[0].properties.layouted_id = clusterChildren[0].properties.layouted_id.replace('clustered_', 'standalone_')
    clusterChildren[0].properties.cluster_r = 100
    clusterChildren[0].properties.cluster_g = 100
    clusterChildren[0].properties.cluster_b = 100
    return false
  }
  return true
})
console.log('Num final clusters after removing non viable clusters:', finalClusters.length)

// Compute cluster centers
finalClusters = finalClusters.map(cluster => {
  const clusterChildren = cluster.children
  const center = turf.centroid(turf.featureCollection(clusterChildren))
  const newCluster = {
    ...cluster,
    geometry: center.geometry
  }

  return newCluster
})

// If a cluster center falls into another bigger cluster's enveloppe,
// merge it to avoid complicated layout further
let mergedClusters = []
finalClusters.forEach(cluster => {
  const biggerCluster = mergedClusters.find(mergedCluster =>
    mergedCluster.envelope !== null && turf.booleanPointInPolygon(cluster, mergedCluster.envelope)
  )
  if (biggerCluster) {
    // cluster center falls within another cluster envelope:
    // do not add cluster in final mergedClusters, and reattach its children to the bigger cluster
    cluster.children.forEach(clusterChild => {
      clusterChild.properties.cluster_id = biggerCluster.properties.layouted_id
      clusterChild.properties.cluster_r = biggerCluster.properties.cluster_r
      clusterChild.properties.cluster_g = biggerCluster.properties.cluster_g
      clusterChild.properties.cluster_b = biggerCluster.properties.cluster_b

      // TODO REMOVE
      clusterChild.properties.old_cluster = cluster.properties.layouted_id
    })
    biggerCluster.children = biggerCluster.children.concat(cluster.children)
    return
  }
  const clusterWithEnvelope = {
    ...cluster,
    // compute a convex shape of all points - can be null if cluster only has 2 points
    envelope: turf.convex(turf.featureCollection(cluster.children))
  }
  mergedClusters.push(clusterWithEnvelope)
})


// Compute cluster stats
const cluster_point_counts = []
mergedClusters = mergedClusters.map(cluster => {
  const clusterChildren = cluster.children

  cluster_point_counts.push(clusterChildren.length)
  return {
    ...cluster,
    properties: {
      ...cluster.properties,
      cluster_point_count: clusterChildren.length,
      sum_popularity: _.sumBy(clusterChildren, a => a.properties.sum_popularity),
      avg_popularity: avg(clusterChildren.map(a => a.properties.sum_popularity)),
      books_count: _.sumBy(clusterChildren, a => a.properties.books_count),
      children: clusterChildren.map(p => p.properties.layouted_id)
    }
  }
})

// Cleanup clusters
mergedClusters.forEach(cluster => {
  delete cluster.children
  delete cluster.envelope
  delete cluster.radius
})
console.log(mergedClusters[0])

console.log('Average cluster # children: ', avg(cluster_point_counts))

const all = finalStandalonePoints.concat(mergedClusters)

fs.writeFileSync(CLUSTERS, JSON.stringify(turf.featureCollection(all)))
console.log('Wrote ', CLUSTERS)