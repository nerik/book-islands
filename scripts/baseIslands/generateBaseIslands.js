#!/usr/bin/env node

const fs = require('fs')
const turf = require('@turf/turf')
const cliProgress = require('cli-progress')
const transposeFeature = require('../util/transposeFeature')
const { SHORELINES, BASE_ISLANDS, BASE_ISLANDS_LOWDEF } = require('../constants')

const islands = JSON.parse(fs.readFileSync(SHORELINES, 'utf-8'))
const numFeatures = islands.features.length

console.log('Read ' , numFeatures, ' polygons')

const MIN_AREA = 300000000 //sq m
const MAX_AREA = 100000000000 //sq m

const geoJSON = {
  'type': 'FeatureCollection',
}
const geoJSONLowdef = {
  'type': 'FeatureCollection',
  features: []
}

const filteredFeatures = islands.features.filter(feature => {
  const a = Math.round(turf.area(feature))
  if (a > MIN_AREA && a < MAX_AREA) {
    return true
  }
})

const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
progressBar.start(filteredFeatures.length, 0)

// console.log(filteredFeatures)

geoJSON.features = filteredFeatures.map((feature, i) => {
  // const bufferedFeature = turf.buffer(feature, 1, {
  //   units: 'kilometers'
  // })
  // const lowdefFeature = turf.simplify(bufferedFeature, {
  const lowdefFeature = turf.simplify(feature, {
    tolerance: .002,
    highQuality: true,
    // mutate: true
  })

  const center = turf.centerOfMass(feature)
  const transposedIsland = transposeFeature(feature, center)

  const properties = {
    id: i,
    originalCenter: turf.coordAll(center)[0],
    center: turf.coordAll(turf.centerOfMass(transposedIsland))[0],
    originalBBox: turf.bbox(feature),
    bbox: turf.bbox(transposedIsland),
  }

  transposedIsland.properties = lowdefFeature.properties = properties

  geoJSONLowdef.features.push(lowdefFeature)

  progressBar.increment()
  return transposedIsland
})

progressBar.stop()

fs.writeFileSync(BASE_ISLANDS, JSON.stringify(geoJSON))
fs.writeFileSync(BASE_ISLANDS_LOWDEF, JSON.stringify(geoJSONLowdef))

console.log('Wrote ', geoJSON.features.length, ' features to ', BASE_ISLANDS)