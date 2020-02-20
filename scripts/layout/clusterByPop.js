#!/usr/bin/env node

const fs = require('fs')
const turf = require('@turf/turf')
const _ = require('lodash')
const supercluster = require('supercluster')
const getAuthorLayoutPriority = require('../util/getAuthorLayoutPriority')
const computeClusterStats = require('./util/computeClusterStats')
const avg = require('../util/avg')

const { AUTHORS, UMAP_GEO, UMAP_CAT_META, CLUSTERS, TEST_BBOX } = require('../constants')

const allfeatures = JSON.parse(fs.readFileSync(UMAP_GEO, 'utf-8')).features
const authors = JSON.parse(fs.readFileSync(AUTHORS, 'utf-8'))
const umapsMeta = JSON.parse(fs.readFileSync(UMAP_CAT_META, 'utf-8'))

const features = allfeatures.filter(
  (feature) =>
    feature.geometry.coordinates[0] > TEST_BBOX.minX &&
    feature.geometry.coordinates[0] < TEST_BBOX.maxX &&
    feature.geometry.coordinates[1] > TEST_BBOX.minY &&
    feature.geometry.coordinates[1] < TEST_BBOX.maxY
)

const authorDict = {}
authors.forEach((author) => {
  authorDict[author.author_slug] = author
})

const authorsInUmapNotInDB = []
const orderedFeatures = features
  .map((feature) => {
    const { author_slug } = feature.properties
    const author = authorDict[author_slug]
    if (!author) {
      authorsInUmapNotInDB.push(author_slug)
      console.log('Author exist in UMAP but not in DB:', author_slug)
      return null
    }
    return {
      ...feature,
      properties: {
        ...feature.properties,
        ...author,
        priority: getAuthorLayoutPriority(author),
      },
    }
  })
  .filter((f) => f !== null)
  .map((feature) => {
    const categoryMeta = umapsMeta[feature.properties.category] || {}

    // overall cluster size (ie radius of the circle which will contain cluster children)
    const CLUSTER_RADIUS_MULT = categoryMeta.clusterRadiusMult || 10
    // minimum priority value to form a cluster (priority is computed from author score, see getAuthorLayoutPriority)
    const MIN_CLUSTER_PRIORITY = categoryMeta.minClusterPriority || 1

    // if feature priority is higher than the threshold, mark it as cluster
    if (feature.properties.priority > MIN_CLUSTER_PRIORITY) {
      // generate a cluster radius:
      // squareroot this fucker to avoid a very big Shakespeare cluster and account
      // for radius/circle area relation)

      // overall cluster size (ie radius of the circle which will contain cluster children)
      const radius = CLUSTER_RADIUS_MULT * Math.sqrt(Math.sqrt(feature.properties.priority))
      return {
        ...feature,
        properties: {
          ...feature.properties,
          will_cluster: true,
        },
        radius,
      }
    }
    return feature
  })

orderedFeatures.sort((a, b) => {
  return b.properties.priority - a.properties.priority
})

console.log(authorsInUmapNotInDB.length, 'authors are in umap output but not in DB')

const clusters = orderedFeatures.filter((f) => f.properties.will_cluster === true)
console.log(
  clusters.length,
  'clusters in first pass with a total of',
  orderedFeatures.length,
  'points'
)

// Prepare Final clusters
const rdChan = () => Math.floor(Math.random() * 255)
const rdCol = () => [rdChan(), rdChan(), rdChan()]
let finalClusters = clusters.map((cluster) => {
  const [cluster_r, cluster_g, cluster_b] = rdCol()
  const feature = {
    ...cluster,
    properties: {
      author_id: cluster.properties.author_slug,
      author_name: cluster.properties.author_name,
      is_cluster: true,
      layouted_id: `cluster_${cluster.properties.author_slug}`,
      cluster_r,
      cluster_g,
      cluster_b,
    },
    radius: cluster.radius,
  }
  return feature
})

// Attach standalone leaves to clusters when they are below a certain radius
const standalonePoints = orderedFeatures.map((point) => {
  const properties = {
    is_cluster: false,
  }
  const closestCluster = _.minBy(finalClusters, (cluster) => {
    const dist = turf.distance(cluster, point)
    const inCluster = dist < cluster.radius
    return inCluster ? dist : null
  })

  if (closestCluster === undefined) {
    properties.layouted_id = `standalone_${point.properties.author_slug}`
    properties.cluster_r = 100
    properties.cluster_g = 100
    properties.cluster_b = 100
  } else {
    properties.layouted_id = `clustered_${point.properties.author_slug}`
    properties.cluster_id = closestCluster.properties.layouted_id
    properties.cluster_r = closestCluster.properties.cluster_r
    properties.cluster_g = closestCluster.properties.cluster_g
    properties.cluster_b = closestCluster.properties.cluster_b
    // console.log(properties, parentCluster)
  }

  const finalPoint = {
    ...point,
    properties: {
      ...properties,
      sum_popularity: point.properties.sum_popularity,
      avg_popularity: point.properties.avg_popularity,
      books_count: point.properties.books_count,
      author_id: point.properties.author_slug,
      author_name: point.properties.author_name,
    },
  }
  return finalPoint
})

const standalonePointsNotClustered = standalonePoints.filter(
  (point) => point.properties.cluster_id === undefined
)

// use supercluster in last round to merge very close standalone points in a large zoom level
const INITIAL_GEO_ZOOM = 9
const bbox = [TEST_BBOX.minX, TEST_BBOX.minY, TEST_BBOX.maxX, TEST_BBOX.maxY]
const standalonCluster = new supercluster({
  radius: 100,
  maxZoom: 16,
})
standalonCluster.load(standalonePointsNotClustered)
console.log('Standalone total points', standalonePointsNotClustered.length)

const standalonClusters = standalonCluster
  .getClusters(bbox, INITIAL_GEO_ZOOM)
  .filter((c) => c.properties.cluster_id)

const geoClusterDict = {}
standalonClusters.forEach((cluster) => {
  const clusterId = cluster.properties.cluster_id
  const leaves = standalonCluster.getLeaves(clusterId, Infinity).map((l) => l.properties.author_id)
  if (leaves && leaves.length) {
    leaves.forEach((leave) => {
      geoClusterDict[leave] = clusterId
    })
  }
})
console.log('Geo clustered standalone points', Object.keys(geoClusterDict).length)

const finalStandalonePoints = standalonePoints.map((point) => {
  if (geoClusterDict[point.properties.author_id]) {
    const clusterId = geoClusterDict[point.properties.author_id]
    const properties = {
      is_cluster: true,
      layouted_id: `clustered_${clusterId}`,
      cluster_id: clusterId,
      cluster_r: '255',
      cluster_g: '0',
      cluster_b: '0',
      supercluster: true,
    }
    return {
      ...point,
      properties: {
        ...point.properties,
        ...properties,
      },
    }
  }
  return point
})

const clusteredPoints = standalonePoints.filter(
  (point) => point.properties.cluster_id !== undefined
)

finalClusters = finalClusters.map((cluster) => {
  const children = clusteredPoints.filter((clusteredPoint) => {
    return clusteredPoint.properties.cluster_id === cluster.properties.layouted_id
  })

  return {
    ...cluster,
    children,
  }
})

// Remove non viable (0/1-point) clusters
finalClusters = finalClusters.filter((cluster) => {
  const clusterChildren = cluster.children
  if (clusterChildren.length === 1) {
    delete clusterChildren[0].properties.cluster_id
    clusterChildren[0].properties.layouted_id = clusterChildren[0].properties.layouted_id.replace(
      'clustered_',
      'standalone_'
    )
    clusterChildren[0].properties.cluster_r = 100
    clusterChildren[0].properties.cluster_g = 100
    clusterChildren[0].properties.cluster_b = 100
    return false
  }
  return true
})
console.log('Num final clusters after removing non-viable clusters:', finalClusters.length)

// Compute cluster centers
finalClusters = finalClusters.map((cluster) => {
  const clusterChildren = cluster.children
  const center = turf.centroid(turf.featureCollection(clusterChildren))
  const newCluster = {
    ...cluster,
    geometry: center.geometry,
  }

  return newCluster
})

// If a cluster center falls into another bigger cluster's enveloppe,
// merge it to avoid complicated layout further

let mergedClusters = []
finalClusters.forEach((cluster) => {
  const biggerCluster = mergedClusters.find(
    (mergedCluster) =>
      mergedCluster.envelope !== null && turf.booleanPointInPolygon(cluster, mergedCluster.envelope)
  )
  if (biggerCluster) {
    // cluster center falls within another cluster envelope:
    // do not add cluster in final mergedClusters, and reattach its children to the bigger cluster
    cluster.children.forEach((clusterChild) => {
      clusterChild.properties.cluster_id = biggerCluster.properties.layouted_id
      clusterChild.properties.cluster_r = biggerCluster.properties.cluster_r
      clusterChild.properties.cluster_g = biggerCluster.properties.cluster_g
      clusterChild.properties.cluster_b = biggerCluster.properties.cluster_b
    })
    biggerCluster.children = biggerCluster.children.concat(cluster.children)
    return
  }
  const clusterWithEnvelope = {
    ...cluster,
    // compute a convex shape of all points - can be null if cluster only has 2 points
    envelope: turf.convex(turf.featureCollection(cluster.children)),
  }
  mergedClusters.push(clusterWithEnvelope)
})

// Compute cluster stats
const cluster_point_counts = []
mergedClusters = mergedClusters.map((cluster) => {
  const clusterChildren = cluster.children

  cluster_point_counts.push(clusterChildren.length)
  return {
    ...cluster,
    properties: {
      ...cluster.properties,
      ...computeClusterStats(clusterChildren),
    },
  }
})

// Cleanup clusters
mergedClusters.forEach((cluster) => {
  delete cluster.children
  delete cluster.envelope
  delete cluster.radius
})

// console.log(finalStandalonePoints.find(p => p.properties.author_id === 'Kingsley Amis'))
// console.log(mergedClusters[0])
// console.log(finalStandalonePoints.find(p => p.properties.cluster_id === mergedClusters[0].properties.layouted_id))

console.log('Average cluster # children: ', avg(cluster_point_counts))

const all = finalStandalonePoints.concat(mergedClusters)
console.log(all.filter((p) => !p.properties.author_id))

fs.writeFileSync(CLUSTERS, JSON.stringify(turf.featureCollection(all)))
console.log('Wrote ', CLUSTERS)
