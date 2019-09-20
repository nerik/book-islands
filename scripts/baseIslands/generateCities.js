#!/usr/bin/env node
const fs = require('fs')
const parse = require('csv-parse/lib/sync')
const turf = require('@turf/turf')
const progressBar = require('../util/progressBar')

const { BASE_ISLANDS, BASE_CITIES } = require('../constants')

const raw = fs.readFileSync('./in/cities/cities500.txt', 'utf-8')
const csv = raw.replace(/,/g, '|').replace(/\t/g, ',')

let cities = parse(csv, {
  skip_lines_with_error: true,
  columns: [
    'geonameid',
    'name',
    'asciiname',
    'alternatenames',
    'latitude',
    'longitude',
    'feature_class',
    'feature_code',
    'country_code',
    'cc2',
    'admin1_code',
    'admin2_code',
    'admin3_code',
    'admin4_code',
    'population',
    'elevation',
    'dem',
    'timezone',
    'modification date'
  ]
})

cities = cities.map(city => {
  const lat = parseFloat(city.latitude)
  const lng = parseFloat(city.longitude)
  const geom = turf.point([lng, lat])
  const { geonameid, name, country_code, population } = city
  return { geom, geonameid, name, country_code, population: parseInt(population) }
})
console.log('Read ', cities.length, ' cities')


const baseIslands = JSON.parse(fs.readFileSync(BASE_ISLANDS, 'utf-8'))

const pb = progressBar(baseIslands.features.length)

const islandsCities = {}
let cnt = 0
let cntWithout = 0
baseIslands.features.forEach(feature => {
  const islandCities = []
  const [minLng, minLat, maxLng, maxLat] = feature.properties.originalBBox
  cities.forEach(city => {
    const [lng, lat] = city.geom.geometry.coordinates
    if (lng > minLng && lng < maxLng && lat > minLat && lng < maxLat) {
      console.log(minLng, minLat, maxLng, maxLat)
      if (turf.booleanWithin(city.geom, feature)) {
        islandCities.push(city)
        cnt++
      }
    }
  })
  if (!islandCities.length) {
    cntWithout++
  }
  islandsCities[feature.properties.id] = islandCities
  pb.increment()
})

pb.stop()

console.log('Attributed', cnt, 'cities')
console.log(cntWithout, ' islands without any city out of ' , baseIslands.features.length)
console.log('Writing', BASE_CITIES)


fs.writeFileSync(BASE_CITIES, JSON.stringify(islandsCities))