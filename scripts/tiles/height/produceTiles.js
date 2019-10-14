#!/usr/bin/env node

const workerpool = require('workerpool')
const {
  TEST_BBOX
  /* BASE_ISLANDS */
} = require('../../constants')
const { getBboxTiles } = require('./utils')
const progressBar = require('../../util/progressBar')
const { performance } = require('perf_hooks')
// const renderTile = require('./renderTile')

const TILE_SIZE_PX = 256
const BBOX = [TEST_BBOX.minX, TEST_BBOX.minY, TEST_BBOX.maxX, TEST_BBOX.maxY]

const produceHeightBitmap = (zoomLevel) => {
  return new Promise((resolve, reject) => {
    if (!zoomLevel) reject('No zoom level passed')
    const pool = workerpool.pool(__dirname + '/worker.js', { minWorkers: 'max' })
    const tiles = getBboxTiles(BBOX, zoomLevel)
    const pb = progressBar(tiles.length)
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i]

      pool
        .exec('renderTile', [tile, TILE_SIZE_PX])
        .then(() => {
          pb.increment()
          const { pendingTasks, activeTasks } = pool.stats()
          if (pendingTasks === 0 && activeTasks === 0) {
            pool.terminate()
            resolve()
          }
        })
        .catch((err) => {
          console.log(err)
          reject(err)
        })
    }
  })
}

const zoomLevels = [8, 9, 10, 11, 12]
async function generateHeightBitMap(zooms = zoomLevels) {
  const tt = performance.now()
  for (let i = 0; i < zooms.length; i++) {
    const zoom = zooms[i]
    const t = performance.now()
    console.log('Starting zoom level', zoom)
    await produceHeightBitmap(zoom)

    console.log(`${zoom} done in ${(performance.now() - t) / 1000}s`)
  }
  console.log(`Total time generation ${(performance.now() - tt) / 1000}`)
  process.exit()
}

generateHeightBitMap()
