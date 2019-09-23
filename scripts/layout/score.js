#!/usr/bin/env node
Error.stackTraceLimit = Infinity
const fs = require('fs')
const turf = require('@turf/turf')
const _ = require('lodash')
const {scale, translate, compose, applyToPoints} = require('transformation-matrix')
const progressBar = require('../util/progressBar')
const pointsWithinFeature = require('../util/pointsWithinFeature')
const bboxRatio = require('../util/bboxRatio')

const {
  UMAP_GEO_CLUSTER, CLUSTERS, BASE_ISLANDS_LOWDEF, BASE_ISLANDS_LOWDEF_MRCT, BASE_ISLANDS_CLUSTER_SCORES,
  TEST_BBOX, MAX_BASE_ISLAND_SCALE_UP
} = require('../constants')

const baseIslandsMrct = JSON.parse(fs.readFileSync(BASE_ISLANDS_LOWDEF_MRCT, 'utf-8'))
const baseIslands = JSON.parse(fs.readFileSync(BASE_ISLANDS_LOWDEF, 'utf-8'))
const umap = JSON.parse(fs.readFileSync(UMAP_GEO_CLUSTER, 'utf-8'))
const clusters = JSON.parse(fs.readFileSync(CLUSTERS, 'utf-8'))

// First project all base island to mercator and translate them to map origin
// TODO move to base island gen?
// const baseIslandsMrct = {
//   'type': 'FeatureCollection',
// }
// baseIslandsMrct.features = baseIslands.features.map(island => {
//   const islandMrct = turf.toMercator(island)
//   const mrctCenter = turf.coordAll(turf.toMercator(turf.point(island.properties.center)))[0]
//   islandMrct.properties.center = mrctCenter
//   islandMrct.properties.area = turf.area(islandMrct)
//   // latest transformations apply first
//   const matrix = compose(
//     // translate to map origin
//     translate(-islandMrct.properties.center[0], -islandMrct.properties.center[1]),
//   )
//   islandMrct.geometry.coordinates[0] = applyToPoints(matrix, islandMrct.geometry.coordinates[0])
//   // mrct.properties.bbox = turf.bbox(mrct)
//   return islandMrct
// })


const transposeAndScale = (center, polygon, newScale = 1) => {
  // latest transformations apply first
  const matrix = compose(
    // translate to target center
    translate(center.geometry.coordinates[0], center.geometry.coordinates[1]),
    // apply transformation(s)
    scale(newScale, newScale),
  )
  
  const newPolygon = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: []
    }
  }
  // TODO that [0] wont work with multipolygons
  newPolygon.geometry.coordinates[0] = applyToPoints(matrix, polygon.geometry.coordinates[0]) 
  return newPolygon
}

// Tries to scale up or down an island so that it fits best cluster points
const findScaleFit = (clusterPointsMrct, clusterCenterMrct, islandMrct) => {
  const transposedNoScale = transposeAndScale(clusterCenterMrct, islandMrct, 1)
  // if points already fit, try scaling down, else try scale up
  const dir = pointsWithinFeature(clusterPointsMrct, transposedNoScale) ? -1 : 1

  let currentScale = 1
  let prevScale = 1
  let prevIslandAtScaleMrct = transposedNoScale

  const STEP_INCREMENT = .2
  const INCREMENT_AMPLITUDE = (dir === 1) ? MAX_BASE_ISLAND_SCALE_UP : 1
  const maxNumIterations = Math.ceil(INCREMENT_AMPLITUDE/STEP_INCREMENT)

  for (let i = 0; i < maxNumIterations; i++) {
    // abandon trying to scale up too much to avoid too distorted geoms
    if (dir === 1 && currentScale >= MAX_BASE_ISLAND_SCALE_UP) {
      // console.log('Cant scale up more, rejecting')
      return { error: 'cantScaleUp' }
    }
    currentScale += STEP_INCREMENT * dir
    // console.log('now trying with scl::', currentScale)
    
    const islandAtScaleMrct = transposeAndScale(clusterCenterMrct, islandMrct, currentScale)
    const fits = pointsWithinFeature(clusterPointsMrct, islandAtScaleMrct)
    // scaling down and it now doesnt fit anymore: use prev
    if (dir === -1 && !fits) {
      // console.log('Scaling down, was fitting at ', prevScale)
      return {
        scale: prevScale,
        islandAtScaleMrct: prevIslandAtScaleMrct
      }
    }

    // scaling up and it now fits: use current
    if (dir === 1 && fits) {
      // console.log('Scaling up, now fits at', currentScale)
      return {
        scale: currentScale,
        islandAtScaleMrct
      }
    }

    prevIslandAtScaleMrct = islandAtScaleMrct
    prevScale = currentScale
  }
  return {
    error: `unknownWithDir${(dir === 1) ? 'Up' : 'Down'}`
  }
}

const getFitScore = (islandAtScale, clusterBuffers) => {
  
  // intersect buffers with island
  const intersected = clusterBuffers.map(b => {
    return turf.intersect(b, islandAtScale)
  })
  // merge buffers - not needed if only one
  const merged = turf.union.apply(null, intersected)

  // compared intersected area vs island total area
  const mergedArea = turf.area(merged)
  const islandArea = turf.area(islandAtScale)

  const r = islandArea/mergedArea

  if (r > 1) {
    // wtf
    return -1
  }

  return r


  // TODO 2 points clusters env is null
  // const clusterArea = turf.area(clusterEnveloppe)
  // const islandArea = turf.area(islandAtScaleMrct)
  // const r = clusterArea/islandArea
  // return r > 1 ? 0 : r
}

const getFitScoreFast = (islandAtScale, clusterEnveloppeArea) => {
  const islandArea = turf.area(islandAtScale)
  const r = clusterEnveloppeArea/islandArea
  return r
}


const filteredClusters = clusters.features
  // TODO 
  .filter(cluster => cluster.properties.point_count > 2)
  .filter(
    cluster => 
      cluster.geometry.coordinates[0] > TEST_BBOX.minX &&
    cluster.geometry.coordinates[0] < TEST_BBOX.maxX &&
    cluster.geometry.coordinates[1] > TEST_BBOX.minY &&
    cluster.geometry.coordinates[1] < TEST_BBOX.maxY
  )
  .slice(0, 1000)

const testFeatures = []
const scores = {}

const pb = progressBar(filteredClusters.length)
filteredClusters.forEach(cluster => {
  const clusterId = cluster.properties.cluster_id
  const allClusterPoints = umap.features
    .filter(p => p.properties.cluster_id === cluster.properties.cluster_id)
  
  const allClusterPointsMrct = allClusterPoints.map(p => turf.toMercator(p))

  const clusterCenterMrct = turf.toMercator(cluster)
  // TODO wil fail with 2 or less points
  const clusterEnveloppe = turf.concave(turf.featureCollection(allClusterPoints))
  const clusterEnveloppeArea = turf.area(clusterEnveloppe)

  // const clusterBBox = turf.bbox(turf.featureCollection(allClusterPointsMrct))
  // const clusterR = bboxRatio(clusterBBox)
  // const clusterBuffers = allClusterPoints.map(p => turf.buffer(p, 10, {
  //   units: 'kilometers',
  //   steps: 8
  // }))
  // const simplifiedClusterBuffers = clusterBuffers.map(b => turf.simplify(b))
  
  const fitScores = baseIslandsMrct.features.map(baseIslandMrct => {
    const islandId = baseIslandMrct.properties.id
    // check if w/h ratios are not too different (ignore for 1pt clusters)
    // if (cluster.properties.point_count > 1 &&
    //     Math.abs(clusterR - baseIslandMrct.properties.r) > 1) {
    //   return {
    //     islandId,
    //     error: 'ratiosDiverge',
    //     fitScore: 0
    //   }
    // }
    const islandMrct = _.cloneDeep(baseIslandMrct)
    const { newScale, islandAtScaleMrct, error } =
      findScaleFit(allClusterPointsMrct, clusterCenterMrct, islandMrct)
    
    if (error !== undefined) {
      return {
        islandId,
        error,
        fitScore: 0
      }
    }

    const islandAtScale = turf.toWgs84(islandAtScaleMrct)

    // const fitScore = getFitScore(islandAtScale, simplifiedClusterBuffers)
    const fitScore = getFitScoreFast(islandAtScale, clusterEnveloppeArea)

    return {
      islandId,
      newScale,
      islandAtScale,
      fitScore,
    }
  })

  const ordered = _.orderBy(fitScores, ['fitScore'], ['desc'])
  // .slice(0, 50)

  // console.log(ordered.filter(f => f.fitScore > 0).map(f => f.fitScore))
  scores[clusterId] = ordered.map(fs => {
    const props = { ... fs }
    delete props.islandAtScale
    return props
  })

  if (ordered[0].fitScore > 0 && ordered[0].islandAtScale) {
    const island = ordered[0].islandAtScale
    island.properties.r = cluster.properties.r
    island.properties.g = cluster.properties.g
    island.properties.b = cluster.properties.b

    testFeatures.push(island)
  }

  pb.increment()
})


console.log('Found at least 1 candidate for', testFeatures.length, '/', filteredClusters.length , 'features')

const avg = (a) => _.sum(a) / a.length
const fitAverages = Object.keys(scores).map(id => scores[id].filter(s => s.fitScore > 0).length)
console.log('Average of', Math.round(avg(fitAverages), 'islands for each cluster (total islands:', baseIslandsMrct.features.length, ')' ))

const geoJSON = {
  'type': 'FeatureCollection',
  features: testFeatures
}

fs.writeFileSync('out/layout/testIslands.geo.json', JSON.stringify(geoJSON))
fs.writeFileSync(BASE_ISLANDS_CLUSTER_SCORES, JSON.stringify(scores))