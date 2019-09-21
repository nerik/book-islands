#!/usr/bin/env node

const fs = require('fs')
const turf = require('@turf/turf')
const progressBar = require('../util/progressBar')
const {translate, compose, applyToPoints} = require('transformation-matrix')
const bboxRatio = require('../util/bboxRatio')

const {
  SHORELINES,
  BASE_ISLANDS,
  BASE_ISLANDS_LOWDEF,
  BASE_ISLANDS_LOWDEF_MRCT
} = require('../constants')

const islands = JSON.parse(fs.readFileSync(SHORELINES, 'utf-8'))
const numFeatures = islands.features.length

console.log('Read ' , numFeatures, ' polygons')

const MIN_AREA = 200000000 //sq m
const MAX_AREA = 50000000000 //sq m

const geoJSON = {
  'type': 'FeatureCollection',
}
const geoJSONLowdef = {
  'type': 'FeatureCollection',
  features: []
}
const geoJSONLowdefMrct = {
  'type': 'FeatureCollection',
  features: []
}

const filteredFeatures = islands.features.filter(feature => {
  const a = Math.round(turf.area(feature))
  if (a > MIN_AREA && a < MAX_AREA) {
    return true
  }
})


console.log(filteredFeatures.length, ' features meet size rquirements out of ', islands.features.length, '\n\n')

const pb = progressBar(filteredFeatures.length)

const getProps = (feature) => {
  const center = turf.coordAll(turf.centerOfMass(feature))[0]
  const bbox = turf.bbox(feature)
  const r = bboxRatio(bbox)
  const areaTotal = turf.area(feature)

  return {
    center,
    bbox,
    r,
    areaTotal
  }
}

geoJSON.features = filteredFeatures.map((feature, i) => {
  // Generate low def, not projected
  // const bufferedFeature = turf.buffer(feature, 1, {
  //   units: 'kilometers'
  // })
  // const lowdefFeature = turf.simplify(bufferedFeature, {
  const featureLowdef = turf.simplify(feature, {
    tolerance: .005,
    highQuality: true,
    // mutate: true
  })
  featureLowdef.properties = getProps(featureLowdef)

  // Generate low def, projected to mercator
  const featureLowdefMrct = turf.toMercator(featureLowdef)
  const originalCenter = turf.coordAll(turf.centerOfMass(featureLowdefMrct))[0]
  const matrix = compose(
    // translate to map origin
    translate(-originalCenter[0], -originalCenter[1]),
  )
  featureLowdefMrct.geometry.coordinates[0] = applyToPoints(matrix, featureLowdefMrct.geometry.coordinates[0])
  featureLowdefMrct.properties = getProps(featureLowdefMrct)
  featureLowdefMrct.properties.wsg84Area = featureLowdef.properties.area

  // Copy island id
  feature.properties.id = featureLowdef.properties.id = featureLowdefMrct.properties.id = i

  geoJSONLowdef.features.push(featureLowdef)
  geoJSONLowdefMrct.features.push(featureLowdefMrct)

  pb.increment()
  return feature
})

pb.stop()

fs.writeFileSync(BASE_ISLANDS, JSON.stringify(geoJSON))
fs.writeFileSync(BASE_ISLANDS_LOWDEF, JSON.stringify(geoJSONLowdef))
fs.writeFileSync(BASE_ISLANDS_LOWDEF_MRCT, JSON.stringify(geoJSONLowdefMrct))

console.log('Wrote ', geoJSON.features.length, ' features to ', BASE_ISLANDS, ',', BASE_ISLANDS_LOWDEF, ',', BASE_ISLANDS_LOWDEF_MRCT)