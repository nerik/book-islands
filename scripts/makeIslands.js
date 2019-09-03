#!/usr/bin/env node
const fs = require('fs')
const execSync = require('child_process').execSync
const turf = require('@turf/turf')
// const _ = require('lodash')

execSync('rm -rf ./out/islands/*')

const islands = require('../out/shorelines.json')
const numFeatures = islands.features.length
console.log(`${numFeatures} islands`)

const MIN_AREA = 300000000 //sq m
const MAX_AREA = 100000000000 //sq m
let wrote = 0

const translateIsland = feature => {
  if (feature.geometry.type !== 'Polygon' || feature.geometry.coordinates.length > 1) {
    console.log('dunno what to do')
    console.log (feature)
    return feature
  }
  const mercatorFeature = turf.toMercator(feature)
  const center = turf.centerOfMass(mercatorFeature)
  const minLng = center.geometry.coordinates[0]
  const minLat = center.geometry.coordinates[1]

  const coords = mercatorFeature.geometry.coordinates[0]
  const translatedCoords = coords.map(c => {
    return [c[0] - minLng, c[1] - minLat]
  })
  const newFeature = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        translatedCoords
      ] 
    },
    properties: {
      ...feature.properties,
      'stroke': '#555555',
      'stroke-width': '.5',
      'stroke-opacity': '.3',
      'fill': '#555555',
      'fill-opacity': 0
    }
  }

  return turf.toWgs84(newFeature)
}

islands.features.forEach((feature, i) => {
  const a = Math.round(turf.area(feature))
  console.log(`${i}/${numFeatures}`)
  if (a > MIN_AREA && a < MAX_AREA) {
    const path = `./out/islands/island-${a}.json`
    const geojson = {
      'type': 'FeatureCollection',
      'features': [
        translateIsland(feature)
      ]
    }
    console.log(`writing ${path}`)
    fs.writeFileSync(path, JSON.stringify(geojson))
    wrote++
  }
})

console.log(`wrote ${wrote} files`)