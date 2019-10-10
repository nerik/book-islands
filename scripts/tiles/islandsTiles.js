#!/usr/bin/env node

const exec = require('child_process').execSync
const fs = require('fs')
const rimraf = require('rimraf')

const { ISLANDS_LOWDEF, ISLANDS, ISLANDS_TILES } = require('../constants')
const mbtiles = `${ISLANDS_TILES}/main.mbtiles`
const tiles = `${ISLANDS_TILES}/tiles`
const mbtilesLowdef = `${ISLANDS_TILES}/main_lowdef.mbtiles`
const tilesLowdef = `${ISLANDS_TILES}/tiles_lowdef`


rimraf.sync(ISLANDS_TILES)
fs.mkdirSync(ISLANDS_TILES)
// try { fs.unlinkSync(mbtiles); fs.unlinkSync(mbtiles) } catch(e) {}

const cmdLowdef = `tippecanoe -o ${mbtilesLowdef} -zg --drop-densest-as-needed -l islands ${ISLANDS_LOWDEF}`
console.log(cmdLowdef)
exec(cmdLowdef)
exec(`mb-util --image_format=pbf ${mbtilesLowdef} ${tilesLowdef} --silent`)

const cmd = `tippecanoe -o ${mbtiles} -zg --drop-densest-as-needed -l islands ${ISLANDS}`
console.log(cmd)
exec(cmd)
exec(`mb-util --image_format=pbf ${mbtiles} ${tiles} --silent`)

