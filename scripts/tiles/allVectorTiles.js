#!/usr/bin/env node

const exec = require('child_process').execSync
const fs = require('fs')
const rimraf = require('rimraf')

const {
  MAX_ZOOM_GENERATED,
  ISLANDS,
  ISLAND_LABELS,
  BOOKS_POINTS,
  ALL_VECTOR_TILES,
  BBOX_CHUNKS,
} = require('../constants')

rimraf.sync(ALL_VECTOR_TILES)
fs.mkdirSync(ALL_VECTOR_TILES)

// Islands
const islandsMbt = `${ALL_VECTOR_TILES}/islands.mbtiles`

const allPaths = BBOX_CHUNKS.map((bbox, chunkIndex) =>
  ISLANDS.replace('.geo.json', `_${chunkIndex}.geo.json`)
).join(' ')

const cmd = `tippecanoe -o ${islandsMbt} --drop-densest-as-needed -l islands ${allPaths} --maximum-zoom=${MAX_ZOOM_GENERATED}`
console.log(cmd)
exec(cmd)

// Points


const pointsMbt = `${ALL_VECTOR_TILES}/points.mbtiles`

const ptsCmd = `tippecanoe -o ${pointsMbt} --minimum-zoom=2 --maximum-zoom=${MAX_ZOOM_GENERATED} --base-zoom=5 --named-layer='author_labels':${ISLAND_LABELS} --named-layer='books_labels':${BOOKS_POINTS}`
console.log(ptsCmd)
exec(ptsCmd)

// ALL VECTOR merged

const allVectorMbt = `${ALL_VECTOR_TILES}/allvector.mbtiles`
const allVectorTiles = `${ALL_VECTOR_TILES}/tiles`

const mergeCmd = `tile-join -o ${allVectorMbt} ${pointsMbt} ${islandsMbt} --no-tile-size-limit`
console.log(mergeCmd)
exec(mergeCmd)

const tilesCmd = `mb-util --image_format=pbf ${allVectorMbt} ${allVectorTiles} --silent`
console.log(tilesCmd)
exec(tilesCmd)
