const tilebelt = require('@mapbox/tilebelt')
const turf = require('@turf/turf')
const _ = require('lodash')
const fs = require('fs')
const fse = require('fs-extra')
const Jimp = require('jimp')
const { heightToRGB, converSNWE } = require('./utils')
const { Hgt } = require('node-hgt')
const { HGT_DATA, BASE_ISLANDS, HEIGHT_TILES, HEIGHT_EMPTY_TILE } = require('../../constants')

const baseIslands = JSON.parse(fs.readFileSync(BASE_ISLANDS, 'utf-8'))
const baseIslandsBboxDict = {}
baseIslands.features.forEach((feature) => {
  baseIslandsBboxDict[feature.properties.island_id] = turf.bbox(feature)
})
const TILE_SIZE_PX = 256

const bboxOverlaps = (tileBbox, islandBbox) => {
  const [tileMinX, tileMinY, tileMaxX, tileMaxY] = tileBbox
  const [islandMinX, islandMinY, islandMaxX, islandMaxY] = islandBbox

  if (islandMinX > tileMaxX || islandMaxX < tileMinX) return false
  if (islandMinY > tileMaxY || islandMaxY < tileMinY) return false
  return true
}

const getTileCoordinates = (islands, tile, tileSize = TILE_SIZE_PX) => {
  const tileBbox = tilebelt.tileToBBOX(tile)
  const overlappingIslands = _.flatMap(islands, (island) => {
    const overlaps = bboxOverlaps(tileBbox, island.bbox)
    return overlaps ? island : []
  })

  const [minTileX, minTileY, maxTileX, maxTileY] = tileBbox
  const lngDelta = Math.abs(maxTileX - minTileX)
  const latDelta = Math.abs(maxTileY - minTileY)
  const lngStep = lngDelta / tileSize
  const latStep = latDelta / tileSize
  const coordinates = []
  let hasOverlap = false

  for (let x = 0; x < tileSize; x++) {
    for (let y = 0; y < tileSize; y++) {
      const lng = minTileX + lngStep * x
      const lat = minTileY + latStep * y
      const island = overlappingIslands.find((island) => {
        return turf.booleanPointInPolygon(turf.point([lng, lat]), island)
      })

      if (island) {
        hasOverlap = true
        const [minX, minY, maxX, maxY] = island.bbox
        const lngRatio = (lng - minX) / (maxX - minX)
        const latRatio = (lat - minY) / (maxY - minY)

        const islandId = island.properties.island_id
        const realIslandBbox = baseIslandsBboxDict[islandId]
        const [realMinX, realMinY, realMaxX, realMaxY] = realIslandBbox

        const realLngDelta = realMaxX - realMinX
        const realLatDelta = realMaxY - realMinY
        const realLng = realMinX + lngRatio * realLngDelta
        const realLat = realMinY + latRatio * realLatDelta

        coordinates.push({ x, y, lat: realLat, lng: realLng })
      } else {
        coordinates.push({ x, y, lat: null, lng: null })
      }
    }
  }
  return hasOverlap ? coordinates : null
}

async function renderTile(islands, tile, tileSize = TILE_SIZE_PX) {
  const [tileX, tileY, tileZ] = tile
  const tilePath = `${HEIGHT_TILES}/${tileZ}/${tileX}/${tileY}.png`
  const coordinates = getTileCoordinates(islands, tile, tileSize)
  if (coordinates) {
    const { r, g, b } = heightToRGB(0)
    const defaultColor = Jimp.rgbaToInt(r, g, b, 255)
    const image = await new Jimp(tileSize, tileSize, defaultColor)
    for (let i = 0; i < coordinates.length; i++) {
      const { x, y, lat, lng } = coordinates[i]
      let elevation = 0
      if (lat && lng) {
        try {
          const srtmCoordinatesString = converSNWE({ lat, lng })
          const floorCoordinates = { lat: Math.floor(lat), lng: Math.floor(lng) }
          const hgt = new Hgt(`${HGT_DATA}/${srtmCoordinatesString}.hgt`, floorCoordinates)
          elevation = hgt.getElevation([lat, lng])
          const { r, g, b } = heightToRGB(elevation)
          const color = Jimp.rgbaToInt(r, g, b, 255)
          image.setPixelColor(color, x, tileSize - 1 - y)
        } catch(e) {
          // console.log(e)
        }
      }
    }
    try {
      await image.write(tilePath)
      return true
    } catch(e) {
      console.log(e)
    }
    return false
  }

  // when there is no island overlap we dont need to create a new image, just copy the empty one
  try {
    fse.copySync(HEIGHT_EMPTY_TILE, tilePath)
    return true
  } catch(e) {
    console.log('Failed copying empty image', e)
    return false
  }
}


module.exports = {
  renderTile,
  getTileCoordinates
}
