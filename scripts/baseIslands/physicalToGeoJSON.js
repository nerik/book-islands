#!/usr/bin/env node

const exec = require('child_process').execSync

const { SHORELINES } = require('../constants')

console.log('Converting shapes to GeoJSON')
exec(
  `npx mapshaper in/shape/GSHHS_f_L1\\ \\(full\\ res\\ shorelines\\)/GSHHS_f_L1.shp -o format=geojson ${SHORELINES}`
)
