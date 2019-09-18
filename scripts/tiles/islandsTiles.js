#!/usr/bin/env node

const exec = require('child_process').execSync
const fs = require('fs')

const { ISLANDS_LOWDEF, ISLANDS_TILES } = require('../constants')

fs.unlinkSync(ISLANDS_TILES)

console.log('Tippecanoe')
exec(`tippecanoe -o ${ISLANDS_TILES} -zg --drop-densest-as-needed ${ISLANDS_LOWDEF}`,
  (error, stdout, stderr) => { console.log(error, stdout, stderr) })
