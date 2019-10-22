#!/usr/bin/env node

const workerpool = require('workerpool')
// const os = require('os')
// const { ISLANDS } = require('../../constants')
const fs = require('fs')
const Jimp = require('jimp')
// const turf = require('@turf/turf')
// const tilebelt = require('@mapbox/tilebelt')
// const _ = require('lodash')
// const { renderTile } = require('./renderTile')
const { getBboxTiles, heightToRGB } = require('./utils')
const progressBar = require('../../util/progressBar')
const { performance } = require('perf_hooks')
const {
  HEIGHT_TILE_SIZE,
  BBOX_CHUNKS,
  HEIGHT_EMPTY_TILE
} = require('../../constants')

const produceHeightBitmap = (bboxIndex, bbox, zoomLevel) => {
  return new Promise((resolve, reject) => {
    if (!zoomLevel) reject('No zoom level passed')
    const pool = workerpool.pool(__dirname + '/worker.js', {
      minWorkers: 'max'
    })
    const tiles = getBboxTiles(bbox, zoomLevel)
    const pb = progressBar(tiles.length)
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i]

      // renderTile(bboxIndex, tile, HEIGHT_TILE_SIZE).then(d => {
      //   console.log(d)
      // })

      pool
        .exec('renderTile', [bboxIndex, tile, HEIGHT_TILE_SIZE])
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

async function blankImage(tileSize = HEIGHT_TILE_SIZE) {
  const { r, g, b } = heightToRGB(0)
  const defaultColor = Jimp.rgbaToInt(r, g, b, 255)
  const image = await new Jimp(tileSize, tileSize, defaultColor)
  await image.write(HEIGHT_EMPTY_TILE)
}

const zoomLevels = [8, 9, 10, 11, 12]
async function generateHeightBitMap(zooms = zoomLevels) {
  const tt = performance.now()
  if (!fs.existsSync(HEIGHT_EMPTY_TILE)) {
    await blankImage()
  }

  // for (let bboxIndex = 0; bboxIndex < BBOX_CHUNKS.length; bboxIndex++) {
  for (let bboxIndex = 1; bboxIndex < 2; bboxIndex++) {
    const bboxt = performance.now()
    console.log('Starting bbox part ', bboxIndex)
    const bbox = BBOX_CHUNKS[bboxIndex]
    for (let i = 0; i < zooms.length; i++) {
      const zoom = zooms[i]
      const t = performance.now()
      console.log('Starting zoom level', zoom)
      await produceHeightBitmap(bboxIndex, bbox, zoom)
      console.log(`${zoom} done in ${(performance.now() - t) / 1000}s`)
    }
    console.log(`Bbox area ${bboxIndex} done in ${(performance.now() - bboxt) / 1000}s`)
  }
  console.log(`Total time generation ${(performance.now() - tt) / 1000}`)
  process.exit()
}

generateHeightBitMap()

module.exports = generateHeightBitMap
