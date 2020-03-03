#!/usr/bin/env node
const fs = require('fs')
const turf = require('@turf/turf')
const progressBar = require('../util/progressBar')
const randomColor = require('../util/randomColor')
const pointWithinBBox = require('../util/pointWithinBBox')
const {
  BBOX_CHUNKS,
  BASE_ISLANDS_LOWDEF_MRCT,
  POINTS_WITH_SCORE,
  ISLANDS_LOWDEF,
  ISLANDS_LOWDEF_BUFF,
} = require('../constants')
const {
  getIslandScaleForPriority,
  cheapIslandsAround,
  overlapsWithIslandsAround,
  getRandomPosAround,
} = require('./areaLayoutUtils')

const baseIslandsMrct = JSON.parse(fs.readFileSync(BASE_ISLANDS_LOWDEF_MRCT, 'utf-8'))

let allFeatures = []
BBOX_CHUNKS.forEach((bbox, chunkIndex) => {
  console.log('Loading points for bbox', bbox)
  const path = POINTS_WITH_SCORE.replace('.geo.json', `_${chunkIndex}.geo.json`)
  const bboxPoints = JSON.parse(fs.readFileSync(path, 'utf-8'))
  allFeatures = allFeatures.concat(bboxPoints.features)
})

allFeatures.sort((a, b) => {
  if (a.properties.children && !b.properties.children) return -1
  if (!a.properties.children && b.properties.children) return 1
  return b.properties.priority - a.properties.priority
})

console.log('Layouting', allFeatures.length, 'features')




const tryToPlaceIsland = (point, baseIslandMrct) => {
  let island
  let finalScale
  let center
  let overlaps = true
  let currentAroundDist = 0
  const AROUND_INCREMENT = 0.1
  while (overlaps === true) {
    center = getRandomPosAround(point, currentAroundDist)
    const centerMrct = turf.toMercator(center)

    const { scale, islandAtScaleMrct } = getIslandScaleForPriority(
      point.properties.priority,
      centerMrct,
      baseIslandMrct
    )
    finalScale = scale
    island = turf.toWgs84(islandAtScaleMrct)

    const islandsAround = cheapIslandsAround(allIslandsBuffers, point, 3)

    overlaps = overlapsWithIslandsAround(island, islandsAround)

    currentAroundDist += AROUND_INCREMENT
  }
  return {
    island,
    scale: finalScale,
    center,
    currentAroundDist: currentAroundDist - AROUND_INCREMENT,
  }
}


const allIslandsBuffers = []

BBOX_CHUNKS.forEach((bboxChunk, chunkIndex) => {
  const bboxFilteredFeatures = allFeatures.filter((cluster) => {
    return pointWithinBBox(cluster, bboxChunk)
  })
  console.log(
    'Current chunk:',
    bboxChunk,
    chunkIndex,
    'with',
    bboxFilteredFeatures.length,
    'features'
  )

  const pb = progressBar(bboxFilteredFeatures.length)
  const bboxIslands = []

  bboxFilteredFeatures.forEach((point) => {
    const isCluster = point.properties.children

    let baseIslandMrct

    if (isCluster) {
      const islandMeta = point.properties.islands_by_score[0]
      baseIslandMrct = baseIslandsMrct.features.find(
        (i) => i.properties.island_id === islandMeta.id
      )
    } else {
      const rdIndex = Math.floor(Math.random() * baseIslandsMrct.features.length)
      baseIslandMrct = baseIslandsMrct.features[rdIndex]
    }

    const { island, scale, center, currentAroundDist } = tryToPlaceIsland(point, baseIslandMrct)

    const col = randomColor()

    island.properties = {
      ...island.properties,
      ...point.properties,
      currentAroundDist,
      scale,
      center,
      uniq_r: col.cluster_r,
      uniq_g: col.cluster_g,
      uniq_b: col.cluster_b,
    }

    allIslandsBuffers.push(turf.buffer(island, 0.005, { units: 'degrees' }))
    bboxIslands.push(island)
    pb.increment()
  })
  pb.stop()

  const islandsLowdefPath = ISLANDS_LOWDEF.replace('.geo.json', `_${chunkIndex}.geo.json`)
  fs.writeFileSync(islandsLowdefPath, JSON.stringify(turf.featureCollection(bboxIslands)))
  console.log('Wrote', islandsLowdefPath)
})

const islandsLowdefBuffPath = ISLANDS_LOWDEF_BUFF
fs.writeFileSync(ISLANDS_LOWDEF_BUFF, JSON.stringify(turf.featureCollection(allIslandsBuffers)))
console.log('Wrote', islandsLowdefBuffPath)