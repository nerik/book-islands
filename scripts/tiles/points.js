#!/usr/bin/env node

const exec = require('child_process').execSync
const fs = require('fs')
const rimraf = require('rimraf')

const { TERRITORY_LABELS, POINTS_TILES } = require('../constants')
const p = `${POINTS_TILES}/main`
const t = `${POINTS_TILES}/tiles`


rimraf.sync(POINTS_TILES)
fs.mkdirSync(POINTS_TILES)
try { fs.unlinkSync(p) } catch(e) {}

console.log('Tippecanoe')
// exec(`tippecanoe -o ${p}_1.mbtiles -zg --drop-densest-as-needed --extend-zooms-if-still-dropping -l territory_labels ${TERRITORY_LABELS}_1`)
// exec(`tippecanoe -o ${p}_2.mbtiles -zg --drop-densest-as-needed --extend-zooms-if-still-dropping -l territory_labels ${TERRITORY_LABELS}_2`)
// exec(`tippecanoe -o ${p}_3.mbtiles -zg --drop-densest-as-needed --extend-zooms-if-still-dropping -l territory_labels ${TERRITORY_LABELS}_3`)
// exec(`tippecanoe -o ${p}_4.mbtiles -zg --drop-densest-as-needed --extend-zooms-if-still-dropping -l territory_labels ${TERRITORY_LABELS}_4`)
// exec(`tile-join -o ${p}.mbtiles ${p}_1.mbtiles ${p}_2.mbtiles ${p}_3.mbtiles ${p}_4.mbtiles`)

exec(`tippecanoe -o ${p}.mbtiles -zg --drop-densest-as-needed --extend-zooms-if-still-dropping -l territory_labels ${TERRITORY_LABELS}`)

const pbf = exec(`mb-util --image_format=pbf ${p}.mbtiles ${t} --silent`)