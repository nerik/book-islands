#!/usr/bin/env node

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
  // if points already fit, try scaling down, else try scale up
  const transposedNoScale = transposeAndScale(clusterCenterMrct, islandMrct, 1)
  const dir = pointsWithinFeature(clusterPointsMrct, transposedNoScale) ? -1 : 1

  let currentScale = 1
  let prevScale = 1
  let prevIslandAtScaleMrct = transposedNoScale

  const STEP_INCREMENT = .05
  const MAX_NUM_ITERATIONS = (1/STEP_INCREMENT) - 1

  for (let i = 0; i < MAX_NUM_ITERATIONS; i++) {
    // abandon trying to scale up too much to avoid too distorted geoms
    if (dir === 1 && currentScale >= MAX_BASE_ISLAND_SCALE_UP) {
      // console.log('Cant scale up more, rejecting')
      return { error: 'cantScaleUp' }
    }

    currentScale += STEP_INCREMENT * dir
    
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
      // console.log('Now fits scaling up at', currentScale)
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

  // // ideal case
  // if (finalIslandMrct) {
  //   return { 
  //     islandAtScaleMrct: finalIslandMrct,
  //     newScale: finalScale
  //   }
  // // if ideal case not found and scaling down: use smallest option
  // } else if (dir === -1) {
  //   console.log('Scaling down, smallest scale found ', currentScale)
  //   return {
  //     islandAtScaleMrct: prevIslandAtScaleMrct,
  //     newScale: prevScale
  //   }
  // }
  // console.log('Couldnt find fit')
  // return { newScale: null }
}

const getFitScore = (islandAtScaleMrct, allClusterPointsMrct, clusterEnveloppe) => {
  // create buffers around all points

  // merge buffers

  // intersect merged buffers with island

  // compared intersected area vs island total area

  // TODO 2 points clusters env is null
  const clusterArea = turf.area(clusterEnveloppe)
  const islandArea = turf.area(islandAtScaleMrct)
  const r = clusterArea/islandArea
  return r > 1 ? 0 : r
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
  .slice(0, 10)

const testFeatures = []
const scores = {}

const pb = progressBar(filteredClusters.length)
filteredClusters.forEach(cluster => {
  const clusterId = cluster.properties.cluster_id
  const allClusterPointsMrct = umap.features
    .filter(p => p.properties.cluster_id === cluster.properties.cluster_id)
    .map(p => turf.toMercator(p))

  const clusterCenterMrct = turf.toMercator(cluster)
  const clusterEnveloppe = turf.concave(turf.featureCollection(allClusterPointsMrct))
  const clusterBBox = turf.bbox(clusterEnveloppe)
  const clusterR = bboxRatio(clusterBBox)
  const fitScores = baseIslandsMrct.features.map(baseIslandMrct => {
    const islandId = baseIslandMrct.properties.id
    // check if w/h ratios are not too different (ignore for 1 and 2 pts clusters)
    if (cluster.properties.point_count > 2 &&
        Math.abs(clusterR - baseIslandMrct.properties.r) > .5) {
      return {
        islandId,
        error: 'ratiosDiverge',
        fitScore: 0
      }
    }
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

    const fitScore = getFitScore(islandAtScaleMrct, allClusterPointsMrct, clusterEnveloppe)
    return {
      islandId,
      newScale,
      islandAtScaleMrct,
      fitScore,
    }
  })

  const ordered = _.orderBy(fitScores, ['fitScore'], ['desc'])
    .slice(0, 10)

  // console.log(ordered.filter(f => f.fitScore > 0).map(f => f.fitScore))
  scores[clusterId] = ordered.map(fs => {
    const props = { ... fs }
    delete props.islandAtScaleMrct
    return props
  })

  if (ordered[0].islandAtScaleMrct) {
    const island = turf.toWgs84(ordered[0].islandAtScaleMrct)
    island.properties.r = cluster.properties.r
    island.properties.g = cluster.properties.g
    island.properties.b = cluster.properties.b

    testFeatures.push(island)
  }

  pb.increment()
})


console.log('Found at least 1 candidate for', testFeatures.length, '/', filteredClusters.length , 'features')

const geoJSON = {
  'type': 'FeatureCollection',
  features: testFeatures
}

fs.writeFileSync('out/layout/testIslands.geo.json', JSON.stringify(geoJSON))
fs.writeFileSync(BASE_ISLANDS_CLUSTER_SCORES, JSON.stringify(scores))