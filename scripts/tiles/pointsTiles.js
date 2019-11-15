#!/usr/bin/env node

const exec = require('child_process').execSync
const fs = require('fs')
const rimraf = require('rimraf')

const { TERRITORY_LABELS, BOOKS_POINTS, POINTS_TILES, MAX_ZOOM_GENERATED } = require('../constants')
const p = `${POINTS_TILES}/main`
const t = `${POINTS_TILES}/tiles`


rimraf.sync(POINTS_TILES)
fs.mkdirSync(POINTS_TILES)

const cmd = `tippecanoe -o ${p}.mbtiles --minimum-zoom=2 --maximum-zoom=${MAX_ZOOM_GENERATED} --base-zoom=5 --named-layer='author_labels':${TERRITORY_LABELS} --named-layer='books_labels':${BOOKS_POINTS}`
console.log(cmd)
exec(cmd)

const tilesCmd = `mb-util --image_format=pbf ${p}.mbtiles ${t} --silent`
console.log(tilesCmd)
exec(tilesCmd)
