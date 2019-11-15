#!/usr/bin/env node
// run with node --max-old-space-size=8192 ./scripts/baseIslands/assignCities.js
const fs = require('fs')
const parse = require('csv-parse/lib/sync')
const turf = require('@turf/turf')
const progressBar = require('../util/progressBar')

const {
  BASE_ISLANDS_LOWDEF,
  GEONAMES_POP_PLACES,
  CITIES_STATS,
  CITIES_REAL,
} = require('../constants')

const csv = fs.readFileSync(GEONAMES_POP_PLACES, 'utf-8')

let popPlaces = parse(csv, {
  columns: true,
  // skip_lines_with_error: true,
})

popPlaces = popPlaces.map((city) => {
  const lat = parseFloat(city.latitude)
  const lng = parseFloat(city.longitude)
  const feature = turf.point([lng, lat])
  feature.properties = { ...city }
  feature.properties.population = parseInt(city.population)
  return feature
})
console.log('Read ', popPlaces.length, ' cities')

const baseIslands = JSON.parse(fs.readFileSync(BASE_ISLANDS_LOWDEF, 'utf-8'))

const pb = progressBar(baseIslands.features.length)

const islandsCities = {}
let cnt = 0
let cntWithout = 0
const features = []
baseIslands.features.forEach((islandFeature) => {
  const islandCities = []
  const [minLng, minLat, maxLng, maxLat] = islandFeature.properties.bbox
  const bufferedIsland = turf.buffer(islandFeature, 10, {
    units: 'kilometers',
  })
  popPlaces.forEach((city) => {
    const [lng, lat] = city.geometry.coordinates
    if (lng > minLng && lng < maxLng && lat > minLat && lng < maxLat) {
      if (turf.booleanWithin(city, bufferedIsland)) {
        islandCities.push(city)
        city.properties.island_id = islandFeature.properties.island_id
        features.push(city)
        cnt++
      }
    }
  })
  if (!islandCities.length) {
    cntWithout++
  }
  islandsCities[islandFeature.properties.island_id] = islandCities
  pb.increment()
})

pb.stop()

console.log('Attributed', cnt, 'cities')
console.log(cntWithout, ' islands without any city out of ', baseIslands.features.length)

console.log('Writing', CITIES_STATS)
fs.writeFileSync(CITIES_STATS, JSON.stringify(islandsCities))
console.log('Writing', CITIES_REAL)
fs.writeFileSync(CITIES_REAL, JSON.stringify(turf.featureCollection(features)))
