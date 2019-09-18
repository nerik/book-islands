#!/usr/bin/env node

// run with node --max-old-space-size=8192

const fs = require('fs')
const cliProgress = require('cli-progress')
const JSONStream = require( 'JSONStream')
const _ = require('lodash')
const { BASE_ISLANDS_LOWDEF, DB, UMAP_GEO, ISLANDS_LOWDEF } = require('../constants')
const transposeFeature = require('../util/transposeFeature')

const baseIslands = JSON.parse(fs.readFileSync(BASE_ISLANDS_LOWDEF, 'utf-8'))
const db = JSON.parse(fs.readFileSync(DB, 'utf-8'))
const umap = JSON.parse(fs.readFileSync(UMAP_GEO, 'utf-8'))

console.log('Read inputs.')

const geoJSON = {
  'type': 'FeatureCollection',
}


const getRandomIsland = () => {
  // const rd = Math.floor(Math.random() * baseIslands.features.length)
  // const path = baseIslands[rd]
  // const island = fs.readFileSync(`${BASE_ISLANDS_PATH}/${path}`, 'utf-8')
  // const geojson = JSON.parse(island)
  // return geojson
  const rd = Math.floor(Math.random() * baseIslands.features.length)
  return baseIslands.features[rd]
}

const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
progressBar.start(umap.features.length, 0)

geoJSON.features = umap.features.map(umapPoint => {
  progressBar.increment()
  const dbRecord = db.find(r => r.id === umapPoint.properties.id)
  if (dbRecord === undefined) {
    console.log('Couldnt find', umapPoint.properties.id)
    return null
  }

  let island = getRandomIsland()

  island.properties.id = dbRecord.id
  island.properties.label = island.properties.id
  island.properties.score = dbRecord.score

  island = transposeFeature(island, umapPoint, .5)

  return island
})
progressBar.stop()

console.log('Done layouting.')

geoJSON.features = _.compact(geoJSON.features)

const transformStream = JSONStream.stringify('{"type":"FeatureCollection","features":[', '\n,\n', ']}')
const outputStream = fs.createWriteStream(ISLANDS_LOWDEF)
transformStream.pipe(outputStream)
geoJSON.features.forEach( transformStream.write )
outputStream.on('finish', () => {
  console.log('JSON done')
})
transformStream.end()


console.log('Wrote ', geoJSON.features.length, ' features to ', ISLANDS_LOWDEF)
