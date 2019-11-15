#!/usr/bin/env node

const exec = require('child_process').execSync
const fs = require('fs')
const rimraf = require('rimraf')

const { TERRITORY_POLYGONS_HIDEF, TERRITORIES_TILES, BBOX_CHUNKS } = require('../constants')
const mbtiles = `${TERRITORIES_TILES}/main.mbtiles`
const tiles = `${TERRITORIES_TILES}/tiles`

rimraf.sync(TERRITORIES_TILES)
fs.mkdirSync(TERRITORIES_TILES)

const allPaths = BBOX_CHUNKS.map((bbox, chunkIndex) =>
  TERRITORY_POLYGONS_HIDEF.replace('.geo.json', `_${chunkIndex}.geo.json`)
).join(' ')

const cmd = `tippecanoe -o ${mbtiles} --minimum-zoom=5 --maximum-zoom=12 --drop-densest-as-needed -l territories ${allPaths}`

console.log(cmd)
exec(cmd)
// tippecanoe.stdout.pipe(process.stdout)

exec(`mb-util --image_format=pbf ${mbtiles} ${tiles} --silent`)
