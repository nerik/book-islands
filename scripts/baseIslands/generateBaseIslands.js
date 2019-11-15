#!/usr/bin/env node

const fs = require('fs')
const turf = require('@turf/turf')
const progressBar = require('../util/progressBar')
const { translate, compose, applyToPoints } = require('transformation-matrix')
const bboxRatio = require('../util/bboxRatio')
const pointWithinBBox = require('../util/pointWithinBBox')

const {
  SHORELINES,
  BASE_ISLANDS,
  BASE_ISLANDS_BBOX,
  BASE_ISLANDS_LOWDEF,
  BASE_ISLANDS_LOWDEF_MRCT,
  ISLETS,
} = require('../constants')

const islands = JSON.parse(fs.readFileSync(SHORELINES, 'utf-8'))
const numFeatures = islands.features.length

console.log('Read ', numFeatures, ' polygons')

const MIN_AREA = 150 //sq km
const MAX_AREA = 2000 //sq km

const geoJSON = {
  type: 'FeatureCollection',
}
const geoJSONLowdef = {
  type: 'FeatureCollection',
  features: [],
}
const geoJSONLowdefMrct = {
  type: 'FeatureCollection',
  features: [],
}

const islandsWithArea = islands.features.map((feature) => {
  return {
    ...feature,
    properties: {
      area: Math.round(turf.area(feature) / 1000000),
    },
  }
})

// Chop at high latitudes - avoids distorsions in elevation tiles
const cleanFeatures = islandsWithArea.filter((feature) => {
  const somePoint = feature.geometry.coordinates[0][0]
  const somePointLat = somePoint[1]
  if (somePointLat > 75 || somePointLat < -75) {
    return false
  }
  return true
})
console.log(
  cleanFeatures.length,
  ' features meet lat requirements out of ',
  islandsWithArea.length,
  '\n\n'
)

// FIlter by min and max area
let filteredFeatures = cleanFeatures.filter((feature) => {
  if (feature.properties.area < MIN_AREA || feature.properties.area > MAX_AREA) {
    return false
  }
  return true
})
console.log(
  filteredFeatures.length,
  ' features meet size requirements out of ',
  cleanFeatures.length,
  '\n\n'
)

// Filter by width - height ratio, to avoird very long islands
// TODO this actually doesn't work at all, because a very long island can be "rotated" at 45º
// For this to work we'd need to calculate the ratio of a rotated bounding box
filteredFeatures = filteredFeatures.filter((feature) => {
  const r = bboxRatio(turf.bbox(feature))
  return r < 5 && r > 0.2
})
console.log(
  filteredFeatures.length,
  ' features meet ratio requirements out of ',
  cleanFeatures.length,
  '\n\n'
)

// Collect islets
const pb = progressBar(filteredFeatures.length)
let selectedIslets = []

const getProps = (feature) => {
  const center = turf.coordAll(turf.centerOfMass(feature))[0]
  const bbox = turf.bbox(feature)
  const r = bboxRatio(bbox)
  const areaTotal = turf.area(feature)

  return {
    center,
    bbox,
    r,
    areaTotal,
  }
}

const MAX_ISLET_MAIN_ISLAND_COAST_DISTANCE = 1
const closeToCoast = (mainIsland, islet) => {
  // Cheaply asses if islet is close to island coast
  // Take a random islet point and check distance with all island points
  const isletRdPoint = islet.geometry.coordinates[0][0]
  return mainIsland.geometry.coordinates[0].some((pt) => {
    const dist = turf.distance(isletRdPoint, pt)
    return dist < MAX_ISLET_MAIN_ISLAND_COAST_DISTANCE
  })
}

geoJSON.features = filteredFeatures.map((feature, i) => {
  pb.increment()

  // Generate low def, not projected
  // const bufferedFeature = turf.buffer(feature, 1, {
  //   units: 'kilometers'
  // })
  // const lowdefFeature = turf.simplify(bufferedFeature, {
  const featureLowdef = turf.simplify(feature, {
    tolerance: 0.005,
    highQuality: true,
    // mutate: true
  })
  featureLowdef.properties = getProps(featureLowdef)

  // Generate low def, projected to mercator
  const featureLowdefMrct = turf.toMercator(featureLowdef)
  const originalCenter = turf.coordAll(turf.centerOfMass(featureLowdefMrct))[0]
  const matrix = compose(
    // translate to map origin
    translate(-originalCenter[0], -originalCenter[1])
  )
  featureLowdefMrct.geometry.coordinates[0] = applyToPoints(
    matrix,
    featureLowdefMrct.geometry.coordinates[0]
  )
  featureLowdefMrct.properties = getProps(featureLowdefMrct)
  featureLowdefMrct.properties.wsg84Area = featureLowdef.properties.area

  // Copy island id
  const island_id = i
  featureLowdef.properties.island_id = featureLowdefMrct.properties.island_id = island_id
  feature.properties = { island_id, area: feature.properties.area }

  geoJSONLowdef.features.push(featureLowdef)
  geoJSONLowdefMrct.features.push(featureLowdefMrct)

  // lookup islets for base island:
  // 1. get all islands significantly smaller than current one
  const currentArea = feature.properties.area
  const areaThreshold = currentArea / 100
  let candidateIslets = cleanFeatures.filter((feature) => {
    if (feature.properties.area < areaThreshold) {
      return true
    }
    return false
  })

  // 2. collect islets in large bbox
  let largeBbox = featureLowdef.properties.bbox
  largeBbox = [largeBbox[0] - 5, largeBbox[1] - 5, largeBbox[2] + 5, largeBbox[3] + 5]
  candidateIslets = candidateIslets.filter((feature) => {
    const somePoint = feature.geometry.coordinates[0][0]
    return pointWithinBBox(somePoint, largeBbox)
  })

  // 3. collect islets close to any of the island lowdef polygon pt
  candidateIslets = candidateIslets.filter((feature) => {
    return closeToCoast(featureLowdef, feature)
  })

  candidateIslets = candidateIslets.map((islet) => {
    return {
      ...islet,
      properties: {
        island_id,
      },
    }
  })

  selectedIslets = selectedIslets.concat(candidateIslets)

  return feature
})

const baseIslandsBboxDict = {}
geoJSON.features.forEach((feature) => {
  baseIslandsBboxDict[feature.properties.island_id] = turf.bbox(feature)
})

fs.writeFileSync(BASE_ISLANDS, JSON.stringify(geoJSON))
fs.writeFileSync(BASE_ISLANDS_BBOX, JSON.stringify(baseIslandsBboxDict))
fs.writeFileSync(BASE_ISLANDS_LOWDEF, JSON.stringify(geoJSONLowdef))
fs.writeFileSync(BASE_ISLANDS_LOWDEF_MRCT, JSON.stringify(geoJSONLowdefMrct))

console.log(
  'Wrote ',
  geoJSON.features.length,
  ' features to ',
  BASE_ISLANDS,
  ',',
  BASE_ISLANDS_LOWDEF,
  ',',
  BASE_ISLANDS_LOWDEF_MRCT
)

fs.writeFileSync(ISLETS, JSON.stringify(turf.featureCollection(selectedIslets)))

console.log('Wrote', selectedIslets.length, 'islets to ', ISLETS)
