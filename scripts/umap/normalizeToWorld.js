#!/usr/bin/env node

const fs = require('fs')
const _ = require('lodash')
const parse = require('csv-parse/lib/sync')
const d3 = require('d3')
const turf = require('@turf/turf')
const { UMAP_GEO } = require('../constants')

const UMAP = './in/umap/UMAP_with_author.csv'

const umap = parse(fs.readFileSync(UMAP, 'utf-8'), {columns: true })
umap.forEach(r => {
  r.x = parseFloat(r.x)
  r.y = parseFloat(r.y)
})

const MIN_LNG = -180
const MAX_LNG = 180
const MIN_LAT = -80
const MAX_LAT = 80

const xMin = _.minBy(umap, r => r.x).x
const xMax = _.maxBy(umap, r => r.x).x
const yMin = _.minBy(umap, r => r.y).y
const yMax = _.maxBy(umap, r => r.y).y

var lng = d3.scaleLinear().domain([xMin, xMax]).range([MIN_LNG, MAX_LNG])
var lat = d3.scaleLinear().domain([yMin, yMax]).range([MIN_LAT, MAX_LAT])

const geoJSON = {
  'type': 'FeatureCollection',
}

geoJSON.features = umap.map(record => {
  const point = turf.point([lng(record.x), lat(record.y)])
  point.properties.id = record.id
  return point
})

fs.writeFileSync(UMAP_GEO, JSON.stringify(geoJSON))

console.log('Wrote ', geoJSON.features.length, ' features to ', UMAP_GEO)