#!/usr/bin/env node

const exec = require('child_process').execSync
const fs = require('fs')
const rimraf = require('rimraf')

const { ISLANDS_LOWDEF, ISLANDS, ISLANDS_TILES, BBOX_CHUNKS } = require('../constants')

const mbtiles = `${ISLANDS_TILES}/main.mbtiles`
const tiles = `${ISLANDS_TILES}/tiles`
const mbtilesLowdef = `${ISLANDS_TILES}/main_lowdef.mbtiles`
const tilesLowdef = `${ISLANDS_TILES}/tiles_lowdef`


rimraf.sync(ISLANDS_TILES)
fs.mkdirSync(ISLANDS_TILES)
// try { fs.unlinkSync(mbtiles); fs.unlinkSync(mbtiles) } catch(e) {}


const allPaths = BBOX_CHUNKS.map((bbox, chunkIndex) =>
  ISLANDS.replace('.geo.json', `_${chunkIndex}.geo.json`)
)
  // .filter((b, i) => i < 2)
  .join(' ')

const cmd = `tippecanoe -o ${mbtiles} -zg --drop-densest-as-needed -l islands ${allPaths}`
console.log(cmd)
exec(cmd)
exec(`mb-util --image_format=pbf ${mbtiles} ${tiles} --silent`)

// const allPathsLowdef = BBOX_CHUNKS.map((bbox, chunkIndex) =>
//   ISLANDS_LOWDEF.replace('.geo.json', `_${chunkIndex}.geo.json`)
// )
//   // .filter((b, i) => i < 2)
//   .join(' ')

// const cmdLowdef = `tippecanoe -o ${mbtilesLowdef} -zg --drop-densest-as-needed -l islands ${allPathsLowdef}`
// console.log(cmdLowdef)
// exec(cmdLowdef)
// exec(`mb-util --image_format=pbf ${mbtilesLowdef} ${tilesLowdef} --silent`)
