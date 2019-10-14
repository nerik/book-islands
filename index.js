#!/usr/bin/env node
const { renderTile, renderTileAsync } = require('./scripts/tiles/height/renderTile')
// const { prepareOffline } = require('./scripts/tiles/height/download')

async function doIt() {
  const tile = [121, 131, 8]
  // await prepareOffline([tile])
  const TILE_SIZE_PX = 256
  try {
    const done = await renderTileAsync(tile, TILE_SIZE_PX)
    console.log('tile done!', done)
  } catch(e) {
    console.log('Error')
    console.log(e)
  }
}

doIt()
