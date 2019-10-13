#!/usr/bin/env node

const fs = require('fs')
const turf = require('@turf/turf')
const JSONStream = require( 'JSONStream')
const progressBar = require('../util/progressBar')
const transposeToWorldCenter = require('../util/transposeToWorldCenter')
const transposeAndScale = require('../util/transposeAndScale')

const { BASE_ISLANDS, ISLANDS_META, ISLANDS, BBOX_CHUNKS } = require('../constants')

const baseIslands = JSON.parse(fs.readFileSync(BASE_ISLANDS, 'utf-8'))
const islandsMeta = JSON.parse(fs.readFileSync(ISLANDS_META, 'utf-8'))


const baseIslandsDict = {}
baseIslands.features.forEach(baseIsland => {
  baseIslandsDict[baseIsland.properties.island_id] = baseIsland
})

const inBBox = (pt, bbox) => {
  return bbox[0] <= pt[0] &&
         bbox[1] <= pt[1] &&
         bbox[2] >= pt[0] &&
         bbox[3] >= pt[1]
}

const allIslandsLayoutedIds = Object.keys(islandsMeta)

BBOX_CHUNKS.forEach((bboxChunk, chunkIndex) => {
  // if (chunkIndex >= 3) {
  //   return
  // }
  console.log('Current chunk:', bboxChunk)
  const islandsLayoutedIds = allIslandsLayoutedIds
    .filter(islandLayoutedId => {
      const meta = islandsMeta[islandLayoutedId]
      if (!meta || meta.error) return false
      const center = meta.center
      return (inBBox(center, bboxChunk))
    })

  console.log('Will collect', islandsLayoutedIds.length, '/', allIslandsLayoutedIds.length)

  const islands = []
  let numFaulty = 0
  const pb = progressBar(islandsLayoutedIds.length)

  islandsLayoutedIds.forEach(islandLayoutedId => {
    pb.increment()
    const meta = islandsMeta[islandLayoutedId]
    if (meta.island_id === undefined) {
      numFaulty++
      return
    }
    const island = baseIslandsDict[meta.island_id]
    const islandMrct = turf.toMercator(island)
    const centerMrct = turf.toMercator(turf.point(meta.center))
    const transposedToCenterMrct = transposeToWorldCenter(islandMrct)
    const transposedIsland = transposeAndScale(centerMrct, transposedToCenterMrct, meta.layoutScale)
    const transposedIslandWgs84 = turf.toWgs84(transposedIsland)

    islands.push(transposedIslandWgs84)
  })

  console.log(islandsLayoutedIds.length, 'islands with', numFaulty, 'faulty')

  const path = ISLANDS.replace('.geo.json', `_${chunkIndex}.geo.json`)

  // fs.writeFileSync(path, JSON.stringify(turf.featureCollection(islands)))
  
  const transformStream = JSONStream.stringify('{"type":"FeatureCollection","features":[', '\n,\n', ']}')
  const outputStream = fs.createWriteStream(path)
  transformStream.pipe(outputStream)
  islands.forEach( transformStream.write )
  outputStream.on('finish', () => {
    console.log('Wrote', path)
  })
  transformStream.end()
})


