const Jimp = require('jimp')
const { heightToRGB } = require('./utils')
const { HEIGHT_TILES, HEIGHT_TILE_SIZE } = require('../../constants')

async function renderTile(coordinates, tile, tileSize = HEIGHT_TILE_SIZE) {
  const [tileX, tileY, tileZ] = tile
  const tilePath = `${HEIGHT_TILES}/${tileZ}/${tileX}/${tileY}.png`
  if (coordinates) {
    const { r, g, b } = heightToRGB(0)
    const defaultColor = Jimp.rgbaToInt(r, g, b, 255)
    const image = await new Jimp(HEIGHT_TILE_SIZE, HEIGHT_TILE_SIZE, defaultColor)
    for (let i = 0; i < coordinates.length; i++) {
      const { x, y, color } = coordinates[i]
      image.setPixelColor(color, x, tileSize - 1 - y)
    }
    return await image.writeAsync(tilePath)
  }
}


module.exports = renderTile
