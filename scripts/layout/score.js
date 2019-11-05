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
  CLUSTERS, BASE_ISLANDS_LOWDEF_MRCT, BASE_ISLANDS_META,
  TEST_BBOX, MAX_BASE_ISLAND_SCALE_UP, BBOX_CHUNKS
} = require('../constants')

const baseIslandsMrct = JSON.parse(fs.readFileSync(BASE_ISLANDS_LOWDEF_MRCT, 'utf-8'))
const clusters = JSON.parse(fs.readFileSync(CLUSTERS, 'utf-8'))

console.log('Read inputs.')

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
        newScale: prevScale,
        islandAtScaleMrct: prevIslandAtScaleMrct
      }
    }

    // scaling up and it now fits: use current
    if (dir === 1 && fits) {
      // console.log('Scaling up, now fits at', currentScale)
      return {
        newScale: currentScale,
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



const points = clusters.features
  .filter(cluster => cluster.properties.is_cluster !== true)


const filteredClusters = clusters.features
  // the clusters geoJSON contains clusters + standalone, remove standalone
  .filter(cluster => cluster.properties.is_cluster === true)
  .filter(
    cluster =>
      cluster.geometry.coordinates[0] > TEST_BBOX.minX &&
    cluster.geometry.coordinates[0] < TEST_BBOX.maxX &&
    cluster.geometry.coordinates[1] > TEST_BBOX.minY &&
    cluster.geometry.coordinates[1] < TEST_BBOX.maxY
  )

console.log('Fitting/scoring', filteredClusters.length, ' clusters')


BBOX_CHUNKS.forEach((bboxChunk, chunkIndex) => {
  // if (chunkIndex >= 2) {
  //   return
  // }
  console.log('Current chunk:', bboxChunk, chunkIndex)

  const testFeatures = []
  const scores = {}


  const bboxFilteredClusters = filteredClusters
    .filter(cluster => {
      return (pointWithinBBox(cluster, bboxChunk))
    })

  console.log('Will score', bboxFilteredClusters.length, '/', filteredClusters.length)

  const pb = progressBar(bboxFilteredClusters.length)

  bboxFilteredClusters.forEach(cluster => {
    const clusterId = cluster.properties.layouted_id
    const allClusterPoints = points
      .filter(p => p.properties.cluster_id === clusterId)

    const allClusterPointsMrct = allClusterPoints.map(p => turf.toMercator(p))

    const clusterCenterMrct = turf.toMercator(cluster)

    const clusterEnveloppe = turf.concave(turf.featureCollection(allClusterPoints))
    let clusterEnveloppeArea
    if (cluster.properties.cluster_point_count > 2) {
      try {
        // this can fail when points are colinear, which happens to happens with the UMAP output
        clusterEnveloppeArea = turf.area(clusterEnveloppe)
      } catch (e) {

      }
    }

    const clusterCanHaveScore = clusterEnveloppeArea !== undefined

    const fitScores = baseIslandsMrct.features.map(baseIslandMrct => {
      const island_id = baseIslandMrct.properties.island_id
      const islandMrct = _.cloneDeep(baseIslandMrct)
      const { newScale, islandAtScaleMrct, error } =
        findScaleFit(allClusterPointsMrct, clusterCenterMrct, islandMrct)

      if (error !== undefined) {
        return {
          island_id,
          error,
          fitScore: 0
        }
      }

      const islandAtScale = turf.toWgs84(islandAtScaleMrct)

      const fitScore = (clusterCanHaveScore)
        ? getFitScoreFast(islandAtScale, clusterEnveloppeArea)
        : null

      return {
        island_id,
        newScale,
        islandAtScale,
        fitScore,
        // clusterCanHaveScore,
      }
    })


    if (clusterCanHaveScore !== true) {
      // console.log(fitScores)
      const fsWithScale = fitScores.filter(fs => fs.error === undefined)
      const maxArea = d3Arr.max(fsWithScale, d => d.islandArea)
      fitScores.filter(fs => fs.error === undefined).forEach(fs => {
        fs.fitScore = (maxArea - fs.islandArea)/maxArea
      })
      // console.log(fitScores)
    }

    const ordered = _.orderBy(fitScores, ['fitScore'], ['desc'])
      .slice(0, 100)

    // console.log(ordered.filter(f => f.fitScore > 0).map(f => f.fitScore))
    scores[clusterId] = ordered.map(fs => {
      const props = { ... fs }
      delete props.islandAtScale
      return props
    })

    // generate test features (ie take "the best" island for each cluster)
    // - not actually in use, just for preview
    let island
    // if (ordered[0].clusterCanHaveScore) {
    if (ordered[0].islandAtScale) {
      island = ordered[0].islandAtScale
    }
    // } else {
    //   const rd = Math.floor(Math.random() * ordered.length)
    //   const scoreObj = ordered[rd]
    //   if (scoreObj.islandAtScale) {
    //     island = scoreObj.islandAtScale
    //   }
    // }
    if (island) {
      island.properties.cluster_r = cluster.properties.cluster_r
      island.properties.cluster_g = cluster.properties.cluster_g
      island.properties.cluster_b = cluster.properties.cluster_b
      testFeatures.push(island)
    }

    pb.increment()
  })
  pb.stop()


  console.log('Found at least 1 candidate for', testFeatures.length, '/', bboxFilteredClusters.length , 'features')

  const avg = (a) => _.sum(a) / a.length
  const fitAverages = Object.keys(scores).map(id => scores[id].filter(s => s.fitScore > 0).length)
  console.log('Average of', Math.round(avg(fitAverages), 'islands for each cluster (total islands:', baseIslandsMrct.features.length, ')' ))

  // const geoJSON = {
  //   'type': 'FeatureCollection',
  //   features: testFeatures
  // }
  // fs.writeFileSync('out/layout/testIslands.geo.json', JSON.stringify(geoJSON))
  const path = BASE_ISLANDS_META.replace('.json', `_${chunkIndex}.json`)
  fs.writeFileSync(path, JSON.stringify(scores))

  console.log('Wrote', path)
})
