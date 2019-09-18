#!/usr/bin/env node

const exec = require('child_process').execSync

// convert relevant shp to geojson

exec(`npx mapshaper in/GSHHS_f_L1 (full res shorelines)/GSHHS_f_L1.shp
          -o format=geojson out/baseIslands/gshhs/shorelines.json`)