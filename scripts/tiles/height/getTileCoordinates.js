const tilebelt = require('@mapbox/tilebelt')
const turf = require('@turf/turf')
const renderTile = require('./renderTile')
const fs = require('fs')
const Jimp = require('jimp')
const { heightToRGB, converSNWE } = require('./utils')
const { Hgt } = require('node-hgt')
const { HGT_DATA, ISLANDS_BBOX, BASE_ISLANDS_BBOX, HEIGHT_TILE_SIZE } = require('../../constants')

const baseIslandsBboxDict = JSON.parse(fs.readFileSync(BASE_ISLANDS_BBOX, 'utf-8'))
const bookIslandsBBoxDict = JSON.parse(fs.readFileSync(ISLANDS_BBOX, 'utf-8'))

const getTileCoordinates = async (data, tile, writeData, done) => {
  const islands = data.islands.islands.features

  if (!islands || !islands.length) {
    done()
    return
  }

  const tileBbox = tilebelt.tileToBBOX(tile)
  const [minTileX, minTileY, maxTileX, maxTileY] = tileBbox
  const lngDelta = Math.abs(maxTileX - minTileX)
  const latDelta = Math.abs(maxTileY - minTileY)
  const lngStep = lngDelta / HEIGHT_TILE_SIZE
  const latStep = latDelta / HEIGHT_TILE_SIZE
  const coordinates = []

  for (let x = 0; x < HEIGHT_TILE_SIZE; x++) {
    for (let y = 0; y < HEIGHT_TILE_SIZE; y++) {
      const lng = minTileX + lngStep * x
      const lat = minTileY + latStep * y
      const intersectedGeom = islands.find((island) => {
        return turf.booleanPointInPolygon(turf.point([lng, lat]), island)
      })

      if (intersectedGeom) {
        const layoutedId = intersectedGeom.properties.layouted_id
        const islandBbox = bookIslandsBBoxDict[layoutedId]
        if (islandBbox) {
          const [minX, minY, maxX, maxY] = islandBbox
          const lngRatio = (lng - minX) / (maxX - minX)
          const latRatio = (lat - minY) / (maxY - minY)

          const islandId = intersectedGeom.properties.island_id
          const realIslandBbox = baseIslandsBboxDict[islandId]
          const [realMinX, realMinY, realMaxX, realMaxY] = realIslandBbox

          const realLngDelta = realMaxX - realMinX
          const realLatDelta = realMaxY - realMinY
          const realLng = realMinX + lngRatio * realLngDelta
          const realLat = realMinY + latRatio * realLatDelta

          let elevation = 0
          try {
            const srtmCoordinatesString = converSNWE({ lat: realLat, lng: realLng })
            const floorCoordinates = { lat: Math.floor(realLat), lng: Math.floor(realLng) }
            const hgt = new Hgt(`${HGT_DATA}/${srtmCoordinatesString}.hgt`, floorCoordinates)
            elevation = hgt.getElevation([realLat, realLng])
          } catch (e) {
            // console.log(e)
          }
          if (elevation >= 0) {
            const { r, g, b } = heightToRGB(elevation)
            const color = Jimp.rgbaToInt(r, g, b, 255)
            coordinates.push({ x, y, color })
          }
        }
      }
    }
  }

  if (coordinates.length > 0) {
    await renderTile(coordinates, tile)
  }
  done()
}

module.exports = getTileCoordinates
