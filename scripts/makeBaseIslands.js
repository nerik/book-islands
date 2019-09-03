#!/usr/bin/env node
const fs = require('fs')
const execSync = require('child_process').execSync
const turf = require('@turf/turf')

const transposeFeature = require('./util/transposeFeature')
// const _ = require('lodash')





execSync('rm -rf ./out/islands/*')

const islands = require('../out/shorelines.json')
const numFeatures = islands.features.length
console.log(`${numFeatures} islands`)

const MIN_AREA = 300000000 //sq m
const MAX_AREA = 100000000000 //sq m
let wrote = 0



const transposeIsland = feature => {
  if (feature.geometry.type !== 'Polygon' || feature.geometry.coordinates.length > 1) {
    console.log('dunno what to do')
    console.log (feature)
    return feature
  }
  const center = turf.centerOfMass(feature)
  const transposedIsland = transposeFeature(feature, center)
  transposedIsland.properties['stroke-opacity'] = .5
  transposedIsland.properties['stroke-width'] = .5
  transposedIsland.properties['fill-opacity'] = 0
  return transposedIsland
}

const overallGeoJSON = {
  'type': 'FeatureCollection',
  'features': []
}

islands.features.forEach((feature, i) => {
  const a = Math.round(turf.area(feature))
  console.log(`${i}/${numFeatures}`)
  if (a > MIN_AREA && a < MAX_AREA) {
    const path = `./out/islands/island-${a}.json`
    const transposedFeature = transposeIsland(feature) 
    const geojson = {
      'type': 'FeatureCollection',
      'features': [
        transposedFeature
      ]
    }
    overallGeoJSON.features.push(transposedFeature)
    console.log(`writing ${path}`)
    fs.writeFileSync(path, JSON.stringify(geojson))
    wrote++
  }
})

fs.writeFileSync('./out/baseIslands.json', JSON.stringify(overallGeoJSON))

console.log(`wrote ${wrote} files`)