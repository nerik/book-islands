#!/usr/bin/env node

const exec = require('child_process').execSync
const fs = require('fs')
const rimraf = require('rimraf')

const {
  MAX_ZOOM_GENERATED,
  ISLANDS,
  ISLAND_LABELS,
  BOOKS_POINTS,
  ISLANDS_TILES,
  POINTS_TILES,
  ALL_VECTOR_TILES,
  BBOX_CHUNKS,
} = require('../constants')

// Islands
const islandsMbt = `${ISLANDS_TILES}/main.mbtiles`

rimraf.sync(ISLANDS_TILES)
fs.mkdirSync(ISLANDS_TILES)

const allPaths = BBOX_CHUNKS.map((bbox, chunkIndex) =>
  ISLANDS.replace('.geo.json', `_${chunkIndex}.geo.json`)
).join(' ')

const cmd = `tippecanoe -o ${islandsMbt} -zg --drop-densest-as-needed -l islands ${allPaths} --maximum-zoom=${MAX_ZOOM_GENERATED}`
console.log(cmd)
exec(cmd)

// Points
rimraf.sync(POINTS_TILES)
fs.mkdirSync(POINTS_TILES)

const pointsMbt = `${POINTS_TILES}/main.mbtiles`

const ptsCmd = `tippecanoe -o ${pointsMbt} --minimum-zoom=2 --maximum-zoom=${MAX_ZOOM_GENERATED} --base-zoom=5 --named-layer='author_labels':${ISLAND_LABELS} --named-layer='books_labels':${BOOKS_POINTS}`
console.log(ptsCmd)
exec(ptsCmd)

// ALL VECTOR merged
rimraf.sync(ALL_VECTOR_TILES)
fs.mkdirSync(ALL_VECTOR_TILES)

const allVectorMbt = `${ALL_VECTOR_TILES}/main.mbtiles`
const allVectorTiles = `${ALL_VECTOR_TILES}/tiles`

const mergeCmd = `tile-join -o ${allVectorMbt} ${pointsMbt} ${islandsMbt}`
console.log(mergeCmd)
exec(mergeCmd)

const tilesCmd = `mb-util --image_format=pbf ${allVectorMbt} ${allVectorTiles} --silent`
console.log(tilesCmd)
exec(tilesCmd)

