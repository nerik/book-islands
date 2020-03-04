#!/usr/bin/env node
Error.stackTraceLimit = Infinity
const fs = require('fs')
const turf = require('@turf/turf')
const _ = require('lodash')
const d3Arr = require('d3-array')
const progressBar = require('../util/progressBar')
const pointsWithinFeature = require('../util/pointsWithinFeature')
const pointWithinBBox = require('../util/pointWithinBBox')
const transposeAndScale = require('../util/transposeAndScale')

const {
  BASE_ISLANDS_LOWDEF_MRCT,
  POINTS,
  POINTS_WITH_SCORE,
  TEST_BBOX,
  MAX_BASE_ISLAND_SCALE_UP,
  BBOX_CHUNKS,
} = require('../constants')

const baseIslandsMrct = JSON.parse(fs.readFileSync(BASE_ISLANDS_LOWDEF_MRCT, 'utf-8'))
const inputPoints = JSON.parse(fs.readFileSync(POINTS, 'utf-8'))

console.log('Read inputs.')

// Tries to scale up or down an island so that it fits best cluster points
const findScaleFit = (clusterPointsMrct, clusterCenterMrct, islandMrct) => {
  const transposedNoScale = transposeAndScale(clusterCenterMrct, islandMrct, 1)
  // if points already fit, try scaling down, else try to scale up
  const dir = pointsWithinFeature(clusterPointsMrct, transposedNoScale) ? -1 : 1

  let currentScale = 1
  let prevScale = 1
  let prevIslandAtScaleMrct = transposedNoScale

  const STEP_INCREMENT = 0.2
  const INCREMENT_AMPLITUDE = dir === 1 ? MAX_BASE_ISLAND_SCALE_UP : 1
  const maxNumIterations = Math.ceil(INCREMENT_AMPLITUDE / STEP_INCREMENT)

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
        newScale: prevScale,
        islandAtScaleMrct: prevIslandAtScaleMrct,
      }
    }

    // scaling up and it now fits: use current
    if (dir === 1 && fits) {
      // console.log('Scaling up, now fits at', currentScale)
      return {
        newScale: currentScale,
        islandAtScaleMrct,
      }
    }

    prevIslandAtScaleMrct = islandAtScaleMrct
    prevScale = currentScale
  }
  return {
    error: `unknownWithDir${dir === 1 ? 'Up' : 'Down'}`,
  }
}

const getFitScore = (islandAtScale, clusterBuffers) => {
  // intersect buffers with island
  const intersected = clusterBuffers.map((b) => {
    return turf.intersect(b, islandAtScale)
  })
  // merge buffers - not needed if only one
  const merged = turf.union.apply(null, intersected)

  // compared intersected area vs island total area
  const mergedArea = turf.area(merged)
  const islandArea = turf.area(islandAtScale)

  const r = islandArea / mergedArea

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

const getFitScoreAreaFast = (islandAtScale, clusterEnveloppeArea) => {
  const islandArea = turf.area(islandAtScale)
  const r = clusterEnveloppeArea / islandArea
  return r
}

const getFitScoreAngle = (islandAtScale, pointA, pointB) => {
  let furthestPointsDist = 0
  let furthestPoints

  const allCoords = islandAtScale.geometry.coordinates[0]
  allCoords.forEach((coordsA) => {
    allCoords.forEach((coordsB) => {
      const d = turf.distance(coordsA, coordsB)
      if (d > furthestPointsDist) {
        furthestPointsDist = d
        furthestPoints = [coordsA, coordsB]
      }
    })
  })

  let islandBearing = turf.bearing(furthestPoints[0], furthestPoints[1])
  if (islandBearing < 0) islandBearing += 180
  let ptsBearing = turf.bearing(pointA, pointB)
  if (ptsBearing < 0) ptsBearing += 180

  // 0: worst score, 1: best score
  const r = 1 / (Math.max(islandBearing, ptsBearing) / Math.min(islandBearing, ptsBearing))

  return r
}

// const nonClusterPoints = inputPoints.features.filter((feature) => !feature.properties.children)

// let clusterPoints = inputPoints.features.filter((feature) => feature.properties.children)

const allPoints = inputPoints.features.filter(
  (cluster) =>
    cluster.geometry.coordinates[0] > TEST_BBOX.minX &&
    cluster.geometry.coordinates[0] < TEST_BBOX.maxX &&
    cluster.geometry.coordinates[1] > TEST_BBOX.minY &&
    cluster.geometry.coordinates[1] < TEST_BBOX.maxY
)

console.log(
  'Fitting/scoring',
  inputPoints.features.length,
  ' pts',
  allPoints.filter((f) => f.properties.children).length,
  'clusters'
)

BBOX_CHUNKS.forEach((bboxChunk, chunkIndex) => {
  // if (chunkIndex >= 2) {
  //   return
  // }
  console.log('Current chunk:', bboxChunk, chunkIndex)

  const testFeatures = []

  const bboxFilteredPoints = allPoints.filter((cluster) => {
    return pointWithinBBox(cluster, bboxChunk)
  })

  console.log('Will score', bboxFilteredPoints.length, '/', allPoints.length)

  const pb = progressBar(bboxFilteredPoints.length)

  bboxFilteredPoints.forEach((cluster) => {
    if (!cluster.properties.children) {
      pb.increment()
      return
    }

    const childrenIds = cluster.properties.children
    const allClusterPoints = allPoints.filter((p) => childrenIds.includes(p.properties.author_id))

    const allClusterPointsMrct = allClusterPoints.map((p) => turf.toMercator(p))

    const clusterCenterMrct = turf.toMercator(cluster)

    const clusterEnveloppe = turf.concave(turf.featureCollection(allClusterPoints))
    let clusterEnveloppeArea
    if (allClusterPoints.length > 2) {
      try {
        // this can fail when points are colinear, which happens to happens with the UMAP output
        clusterEnveloppeArea = turf.area(clusterEnveloppe)
      } catch (e) {}
    }

    const fitScores = baseIslandsMrct.features.map((baseIslandMrct) => {
      const island_id = baseIslandMrct.properties.island_id
      const islandMrct = _.cloneDeep(baseIslandMrct)
      const { newScale, islandAtScaleMrct, error } = findScaleFit(
        allClusterPointsMrct,
        clusterCenterMrct,
        islandMrct
      )

      if (error !== undefined) {
        return {
          island_id,
          error,
          fitScore: 0,
        }
      }

      const islandAtScale = turf.toWgs84(islandAtScaleMrct)

      const fitScore =
        allClusterPoints.length > 2
          ? getFitScoreAreaFast(islandAtScale, clusterEnveloppeArea)
          : getFitScoreAngle(islandAtScale, allClusterPoints[0], allClusterPoints[1])

      return {
        islandArea: turf.area(islandAtScale),
        island_id,
        newScale,
        islandAtScale,
        fitScore,
      }
    })

    const ordered = _.orderBy(fitScores, ['fitScore'], ['desc']).slice(0, 100)

    // randomly apply score to either cluster center or cluster center + children
    // This is done to avoid the "fish swarm" effect when always applying same "direction" 
    // to cluster children
    const applyToPoints = Math.random() > 0.5 ? allClusterPoints : [cluster]

    applyToPoints.forEach((p) => {
      p.properties.islands_by_score = ordered.map((fs) => {
        return { id: fs.island_id, scale: fs.newScale }
      })
    })

    pb.increment()
  })
  pb.stop()

  const path = POINTS_WITH_SCORE.replace('.geo.json', `_${chunkIndex}.geo.json`)
  fs.writeFileSync(path, JSON.stringify(turf.featureCollection(bboxFilteredPoints)))

  console.log('Wrote', path)
})
