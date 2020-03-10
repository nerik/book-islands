#!/usr/bin/env node

const exec = require('child_process').execSync
const fs = require('fs')
const rimraf = require('rimraf')

const {
  MAX_ZOOM_VECTOR,
  ISLANDS,
  ISLAND_LABELS,
  BOOKS_POINTS,
  ISLAND_TILES,
  POINT_TILES,
  BBOX_CHUNKS,
} = require('../constants')

// Islands
rimraf.sync(ISLAND_TILES)
fs.mkdirSync(ISLAND_TILES)

const allPaths = BBOX_CHUNKS.map((bbox, chunkIndex) =>
  ISLANDS.replace('.geo.json', `_${chunkIndex}.geo.json`)
).join(' ')

const islandsMbt = `${ISLAND_TILES}/islands.mbtiles`
const islandsTiles = `${ISLAND_TILES}/tiles`
const cmd = `tippecanoe -o ${islandsMbt} --drop-densest-as-needed -l islands ${allPaths} --maximum-zoom=${MAX_ZOOM_VECTOR}`
console.log(cmd)
exec(cmd)

const tilesCmd = `mb-util --image_format=pbf ${islandsMbt} ${islandsTiles} --silent`
console.log(tilesCmd)
exec(tilesCmd)

// Points
rimraf.sync(POINT_TILES)
fs.mkdirSync(POINT_TILES)

const CONFIG = {
  author: {
    path: ISLAND_LABELS,
    ranks: [
      null,
      {
        minzoom: 8,
      },
      {
        minzoom: 6,
      },
      {
        minzoom: 4,
      },
      {
        minzoom: 3,
      },
    ],
  },
  books: {
    path: BOOKS_POINTS,
    ranks: [
      null,
      {
        minzoom: 8,
      },
      {
        minzoom: 8,
      },
      {
        minzoom: 8,
      },
      {
        minzoom: 8,
      },
    ],
  },
}

const mbts = []
Object.keys(CONFIG).forEach((pointType) => {
  const config = CONFIG[pointType]
  for (let i = 4; i > 0; i--) {
    const rankConfig = config.ranks[i]
    const name = `${pointType}-rank${i}`
    const mbt = `${POINT_TILES}/${name}.mbtiles`
    const filter = `--feature-filter '{ "*": ["==", "rank", ${i}] }'`
    const ptsCmd = `tippecanoe -o ${mbt} --minimum-zoom=${rankConfig.minzoom} --maximum-zoom=${MAX_ZOOM_VECTOR} --base-zoom=${rankConfig.minzoom} --named-layer='${name}':${config.path} ${filter}`
    console.log(ptsCmd)
    exec(ptsCmd)
    mbts.push(mbt)
  }
})

// ALL POINTS merged
const allPointsTiles = `${POINT_TILES}/tiles`

const mergeCmd = `tile-join ${mbts.join(' ')} --no-tile-size-limit --output-to-directory=${allPointsTiles}`
console.log(mergeCmd)
exec(mergeCmd)
