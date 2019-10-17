#!/usr/bin/env node

const exec = require('child_process').execSync
const fs = require('fs')
const rimraf = require('rimraf')

const { TERRITORY_FRONTIERS, TERRITORIES_TILES } = require('../constants')
const p = `${TERRITORIES_TILES}/main.mbtiles`
const t = `${TERRITORIES_TILES}/tiles`


rimraf.sync(TERRITORIES_TILES)
fs.mkdirSync(TERRITORIES_TILES)
try { fs.unlinkSync(p) } catch(e) {}

console.log('Tippecanoe')
const tippecanoe = exec(`tippecanoe -o ${p} -zg --drop-densest-as-needed -l territories ${TERRITORY_FRONTIERS}`)
// tippecanoe.stdout.pipe(process.stdout)

const pbf = exec(`mb-util --image_format=pbf ${p} ${t} --silent`)