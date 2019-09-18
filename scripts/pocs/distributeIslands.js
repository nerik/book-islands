#!/usr/bin/env node

const fs = require('fs')
const turf = require('@turf/turf')
const JSONStream = require( 'JSONStream')
const transposeFeature = require('./util/transposeFeature')

const BASE_ISLANDS_PATH = './out/islands/'


const MERCATOR_START = 20037508.3427892
const MERCATOR_EXTENT = MERCATOR_START * 2

// const baseIslands = fs.readdirSync(BASE_ISLANDS_PATH).filter(p => p.match(/island-\d+\.json/) !== null)
const baseIslands = require('../out/baseIslands.json')

const getRandomIsland = () => {
  // const rd = Math.floor(Math.random() * baseIslands.features.length)
  // const path = baseIslands[rd]
  // const island = fs.readFileSync(`${BASE_ISLANDS_PATH}/${path}`, 'utf-8')
  // const geojson = JSON.parse(island)
  // return geojson
  const rd = Math.floor(Math.random() * baseIslands.features.length)
  return baseIslands.features[rd]
}

const NUM_ISLANDS = 50000
// const NUM_ISLANDS = 100
const numIslandsSide = Math.floor(Math.sqrt(NUM_ISLANDS))
const projectedInterval = MERCATOR_EXTENT / numIslandsSide

const allCenters = []
for (let gridX = 0; gridX < numIslandsSide; gridX++) {
  for (let gridY = 0; gridY < numIslandsSide; gridY++) {
    const centerX = -MERCATOR_START + gridX * projectedInterval + projectedInterval / 2
    const centerY = -MERCATOR_START + gridY * projectedInterval + projectedInterval / 2
    const projectedCenter = turf.point([centerX, centerY])
    const center = turf.toWgs84(projectedCenter)
    allCenters.push(center.geometry.coordinates)
    // const island = getRandomIsland()
    // const transposedIsland = transposeFeature(island.features[0], center)
    // allCenters.push(transposedIsland)
  }
}

const transformStream = JSONStream.stringify('{"type":"FeatureCollection","features":[', '\n,\n', ']}')
const outputStream = fs.createWriteStream('./out/randomIslands.json')
transformStream.pipe(outputStream)
allCenters.forEach((p, i) => {
  console.log(i)
  try {
    const island = getRandomIsland()
    const center = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Point',
        coordinates: p
      }
    }
    // const transposedIsland = transposeFeature(island.features[0], center, 0.1)
    const transposedIsland = transposeFeature(island, center, 0.1)
    transformStream.write(transposedIsland)
  } catch(e) {
    console.log(e)
  }
})
outputStream.on('error', (a) => {
  console.log(a)
})  
transformStream.on('error', (a) => {
  console.log(a)
})  
transformStream.on('end', () => {
  console.log('end JSON stringify')
})  
outputStream.on('finish', () => {
  console.log('JSON done')
})
transformStream.end()





// const geojson = {
//   'type': 'FeatureCollection',
//   'features': allFeatures
// }

// fs.writeFileSync('./out/randomIslands.json', JSON.stringify(geojson))

// console.log(getRandomIsland().properties)