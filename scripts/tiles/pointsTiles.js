#!/usr/bin/env node

const exec = require('child_process').execSync
const fs = require('fs')
const rimraf = require('rimraf')

const { TERRITORY_LABELS, BOOKS_POINTS, POINTS_TILES } = require('../constants')
const p = `${POINTS_TILES}/main`
const t = `${POINTS_TILES}/tiles`


rimraf.sync(POINTS_TILES)
fs.mkdirSync(POINTS_TILES)
// try { fs.unlinkSync(p) } catch(e) {}

const cmd = `tippecanoe -o ${p}.mbtiles -zg --drop-densest-as-needed --extend-zooms-if-still-dropping --named-layer='author_labels':${TERRITORY_LABELS} --named-layer='books_labels':${BOOKS_POINTS}`
console.log(cmd)
exec(cmd)

const pbf = exec(`mb-util --image_format=pbf ${p}.mbtiles ${t} --silent`)