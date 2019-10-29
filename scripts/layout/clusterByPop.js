#!/usr/bin/env node

const fs = require('fs')
const turf = require('@turf/turf')
const _ = require('lodash')
const getAuthorLayoutPriority = require('../util/getAuthorLayoutPriority')
const avg = require('../util/avg')

const { AUTHORS, UMAP_GEO, CLUSTERS } = require('../constants')

const CLUSTER_RADIUS_MULT = 5 // overall cluster size
const MIN_CLUSTER_PRIORITY = 10 // min priority to try to form a cluster (see getAuthorLayoutPriority)


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
          radius
        }
      }
    }
    return feature
  })
  .sort((a, b) => {
    return a.priority - b.priority
  })

console.log(authorsInUmapNotInDB.length, 'authors are in umap output but not in DB')

const clusters = orderedFeatures.filter(f => f.properties.will_cluster === true)
console.log(clusters.length, 'clusters in first pass')


// // Merge clusters that are touching, ie their center to center distance is less
// // than the sum of their radii. 
// // Start by collecting neighbors
// const allNeighborsIds = []
// let allMergedIds = []
// clusters.forEach(cluster => {
//   let neighborsIds
//   clusters.forEach(overlappingCluster => {
//     if (cluster.properties.id === overlappingCluster.properties.id) {
//       return
//     }
//     const d = turf.distance(cluster, overlappingCluster)
//     if (d < cluster.properties.radius + overlappingCluster.properties.radius) {
//       if (!neighborsIds) {
//         neighborsIds = [cluster.properties.id]
//       }
//       neighborsIds.push(overlappingCluster.properties.id)
//     }
//   })
//   if (neighborsIds) {
//     allNeighborsIds.push(neighborsIds)
//   } else {
//     allMergedIds.push([cluster.properties.id])
//   }
// })

// // Merge neighbors into clusters
// allNeighborsIds.forEach(neighborsIds => {
//   for (let i = 0; i < allMergedIds.length; i++) {
//     const mergedIds = allMergedIds[i]
//     if (_.intersection(neighborsIds, mergedIds).length) {
//       allMergedIds[i] = _.uniq(allMergedIds[i].concat(neighborsIds))
//       return
//     }
//   }
//   allMergedIds.push(neighborsIds)
// })




// Remove 1-point clusters
// allMergedIds = allMergedIds.filter(ids => {
//   return ids.length > 1
// })
let allMergedIds = clusters.map(c => [c.properties.id])


// Prepare Final clusters
const rdChan = () => Math.floor(Math.random() * 255)
const rdCol = () => [rdChan(),rdChan(),rdChan()]
let finalClusters = allMergedIds.map(mergedIds => {
  const points = clusters.filter(c => mergedIds.includes(c.properties.id))
  const feature = turf.centerOfMass(turf.featureCollection(points))
  const [cluster_r,cluster_g,cluster_b] = rdCol()
  feature.properties = {
    is_cluster: true,
    layouted_id: `cluster_${mergedIds[0]}`,
    original_clusters: mergedIds,
    cluster_r,
    cluster_g,
    cluster_b,
    centers: points
  }
  return feature
})

// Attach standalone leaves to clusters
const finalStandalonePoints = orderedFeatures.map(point => {
  const properties = {
    is_cluster: false
  }
  // check if point is within cluster centers radii (check with centers)
  // const parentClusters = finalClusters.filter(cluster => {
  //   return cluster.properties.centers.some(clusterCenter =>
  //     turf.distance(clusterCenter, point) < clusterCenter.properties.radius
  //   )
  // })

  const closestCluster = _.minBy(finalClusters, (cluster) => {
    const closestClusterCenter = _.minBy(cluster.properties.centers, (clusterCenter) => {
      const dist = turf.distance(clusterCenter, point)
      const inCluster = dist < clusterCenter.properties.radius
      // if (inCluster && point.properties.id === 'Leo Bretholz') {
      //   console.log(dist)
      //   console.log(cluster)
      //   console.log(clusterCenter)
      // }
      return (inCluster) ? dist : null
    })
    return (closestClusterCenter) ? closestClusterCenter : null
  })
  // console.log(point.properties.id)
  // if(point.properties.id === 'Leo Bretholz') {
  //   console.log(point)
  //   console.log(closestCluster)
  // }

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

// Remove 1-point clusters
console.log(finalClusters.length)
finalClusters = finalClusters.filter(cluster => {
  const clusterChildren = clusteredPoints
    .filter(clusteredPoint => {
      return clusteredPoint.properties.cluster_id === cluster.properties.layouted_id
    })
  if (clusterChildren.length === 0) {
    return false
  }
  if (cluster.properties.layouted_id === 'cluster_Richard Russo') {
    console.log(cluster)
    console.log(clusterChildren)
  }
  if (clusterChildren.length === 1) {
    delete clusterChildren[0].properties.cluster_id
    clusterChildren[0].properties.layouted_id = clusterChildren[0].properties.layouted_id.replace('clustered_', 'standalone_')
    return false
  }
  return true
})
console.log(finalClusters.length)


// Compute cluster stats
const cluster_point_counts = []
finalClusters = finalClusters.map(cluster => {
  const clusterChildren = clusteredPoints
    .filter(clusteredPoint => {
      return clusteredPoint.properties.cluster_id === cluster.properties.layouted_id
    })
  if (clusterChildren.length === 1) {

    console.log(cluster)
    console.log(clusterChildren)
  }
  
  cluster_point_counts.push(clusterChildren.length)
  return {
    ...cluster,
    properties: {
      ...cluster.properties,
      cluster_point_count: clusterChildren.length,
      sum_popularity: _.sumBy(clusterChildren, a => a.properties.sum_popularity),
      avg_popularity: avg(clusterChildren.map(a => a.properties.sum_popularity)),
      books_count: _.sumBy(clusterChildren, a => a.properties.books_count)
    }
  }
})


console.log('average cluster # children: ', avg(cluster_point_counts))

const all = finalStandalonePoints.concat(finalClusters)

fs.writeFileSync(CLUSTERS, JSON.stringify(turf.featureCollection(all)))
console.log('Wrote ', CLUSTERS)