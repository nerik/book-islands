#!/usr/bin/env node
const fs = require('fs')
const turf = require('@turf/turf')
const exec = require('child_process').execSync

// columns: [
//   'geonameid',
//   'name',
//   'asciiname',
//   'alternatenames',
//   'latitude',
//   'longitude',
//   'feature_class',
//   'feature_code',
//   'country_code',
//   'cc2',
//   'admin1_code',
//   'admin2_code',
//   'admin3_code',
//   'admin4_code',
//   'population',
//   'elevation',
//   'dem',
//   'timezone',
//   'modification date'
// ]

// get allCountries.txt then
// sed -i .bak 's/,/|/g' in/cities/allCountries.txt
// sed -i .bak 's/"/_/g' in/cities/allCountries.txt
// sed -i .bak $'s/\t/,/g' in/cities/allCountries.txt
// echo echo "geonameid,name,asciiname,alternatenames,latitude,longitude,feature_class,feature_code,country_code,cc2,admin1_code,admin2_code,admin3_code,admin4_code,population,elevation,dem,timezone,modification date" | cat - in/cities/allCountries.txt > /tmp/out && mv /tmp/out in/cities/allCountries.txt

// then import into the SQL db - this takes a long fucking while
// sqlite> .open out/baseIslands/geonames.db
// sqlite> create table geonames(geonameid,name,asciiname,alternatenames,latitude,longitude,feature_class,feature_code,country_code,cc2,admin1_code,admin2_code,admin3_code,admin4_code,population,elevation,dem,timezone,modification_date);
// sqlite> .mode csv
// sqlite> .import in/cities/allCountries.txt geonames
// sqlite> .quit

const { GEONAMES_DB, GEONAMES_POP_PLACES } = require('../constants')

exec(
  `sqlite3 -header -separator "," ${GEONAMES_DB} \'SELECT geonameid,name,latitude,longitude,feature_class,feature_code,population FROM geonames WHERE feature_code="PPL";\' > ${GEONAMES_POP_PLACES}`
)
