#!/usr/bin/env node

const exec = require('child_process').execSync
const fs = require('fs')
const rimraf = require('rimraf')

const { ISLANDS_LOWDEF, ISLANDS_TILES } = require('../constants')

rimraf(ISLANDS_TILES)
fs.mkdirSync(ISLANDS_TILES)

console.log('Tippecanoe')
const tippecanoe = exec(`tippecanoe -o ${ISLANDS_TILES}/main.mbtiles -zg --drop-densest-as-needed ${ISLANDS_LOWDEF}`)
tippecanoe.stdout.pipe(process.stdout)

const pbf = exec(`mb-util --image_format=pbf ${ISLANDS_TILES}/main.mbtiles ${ISLANDS_TILES}/ --silent`)