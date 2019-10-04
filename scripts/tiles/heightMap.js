#!/usr/bin/env node
const fs = require('fs')
const turf = require('@turf/turf')
const _ = require('lodash')
var cover = require('@mapbox/tile-cover')
const tilebelt = require('@mapbox/tilebelt')
const { TEST_BBOX, ISLANDS_LOWDEF, BASE_ISLANDS } = require('../constants')

// const TILE_WIDTH = 512
const TILE_NUM_CELLS = 10

const islands = JSON.parse(fs.readFileSync(ISLANDS_LOWDEF, 'utf-8'))
const baseIslands = JSON.parse(fs.readFileSync(BASE_ISLANDS, 'utf-8'))

const baseIslandDict = {}
baseIslands.features.forEach(feature => {
  baseIslandDict[feature.properties.island_id] = feature
})
const baseIslandsBboxDict = {}
baseIslands.features.forEach(feature => {
  baseIslandsBboxDict[feature.properties.island_id] = turf.bbox(feature)
})

const bbox = [TEST_BBOX.minX, TEST_BBOX.minY, TEST_BBOX.maxX, TEST_BBOX.maxY]

const geom = turf.bboxPolygon(bbox).geometry
var limits = { min_zoom: 10, max_zoom: 10 }

const tiles = cover.tiles(geom, limits)
const islandsBbox = islands.features.map(feature => turf.bbox(feature))

const bboxOverlaps = (tileBbox, islandBbox) => {
  const [ tileMinX, tileMinY, tileMaxX, tileMaxY] = tileBbox
  const [ islandMinX, islandMinY, islandMaxX, islandMaxY] = islandBbox

  if (islandMinX > tileMaxX || islandMaxX < tileMinX) return false
  if (islandMinY > tileMaxY || islandMaxY < tileMinY) return false
  return true
}

const testPoints = []

for (let i = 0; i < tiles.length; i++) {
  const tile = tiles[i]
  const tileBbox = tilebelt.tileToBBOX(tile)
  const overlappingIslands = _.flatMap(islandsBbox, (islandBbox, index) => {
    const overlaps = bboxOverlaps(tileBbox, islandBbox)
    if (!overlaps) return []
    const island = islands.features[index]
    return {
      ...island,
      properties: {
        ...island.properties,
        bbox: islandBbox
      }
    }
  })


  const [ lngStart, latStart, lngEnd, latEnd ] = tileBbox

  const lngDelta = Math.abs(lngEnd - lngStart)
  const latDelta = Math.abs(latEnd - latStart)
  const lngStep = lngDelta / TILE_NUM_CELLS
  const latStep = latDelta / TILE_NUM_CELLS

  for (let x = 0; x < TILE_NUM_CELLS; x++) {
    for (let y = 0; y < TILE_NUM_CELLS; y++) {
      const lng = lngStart + lngStep * x
      const lat = latStart + latStep * y
      // console.log(lng, lat)
      const island = overlappingIslands.find(island => {
        return turf.booleanPointInPolygon(turf.point([lng, lat]), island)
      })

      if (!island) continue

      const islandBbox = island.properties.bbox
      const [minX, minY, maxX, maxY] = islandBbox
      const lngRatio = (lng - minX) / (maxX - minX)
      const latRatio = (lat - minY) / (maxY - minY)
      // console.log(lngRatio, latRatio)

      const islandId = island.properties.island_id
      const realIslandBbox = baseIslandsBboxDict[islandId]
      const [realMinX, realMinY, realMaxX, realMaxY] = realIslandBbox

      const realLngDelta = realMaxX - realMinX
      const realLatDelta = realMaxY - realMinY
      const realLng = realMinX + lngRatio * realLngDelta
      const realLat = realMinY + latRatio * realLatDelta


      testPoints.push(turf.point([realLng, realLat]))
    }
  }
}
fs.writeFileSync('test.json', JSON.stringify(turf.featureCollection(testPoints)))
