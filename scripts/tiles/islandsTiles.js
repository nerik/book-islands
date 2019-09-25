#!/usr/bin/env node

const exec = require('child_process').execSync
const fs = require('fs')
const rimraf = require('rimraf')

const { ISLANDS_LOWDEF, ISLANDS_TILES } = require('../constants')
const p = `${ISLANDS_TILES}/main.mbtiles`
const t = `${ISLANDS_TILES}/tiles`


rimraf.sync(ISLANDS_TILES)
fs.mkdirSync(ISLANDS_TILES)
try { fs.unlinkSync(p) } catch(e) {}

console.log('Tippecanoe')
const tippecanoe = exec(`tippecanoe -o ${p} -zg --drop-densest-as-needed -l islands ${ISLANDS_LOWDEF}`)
// tippecanoe.stdout.pipe(process.stdout)

const pbf = exec(`mb-util --image_format=pbf ${p} ${t} --silent`)