#!/usr/bin/env node

const fs = require('fs')
const turf = require('@turf/turf')
const JSONStream = require( 'JSONStream')
const progressBar = require('../util/progressBar')
const transposeToWorldCenter = require('../util/transposeToWorldCenter')
const transposeAndScale = require('../util/transposeAndScale')
const pointWithinBBox = require('../util/pointWithinBBox')

const {
  BASE_ISLANDS, ISLANDS_META, ISLANDS, ISLETS,
  BBOX_CHUNKS
} = require('../constants')

const baseIslands = JSON.parse(fs.readFileSync(BASE_ISLANDS, 'utf-8'))
const islets = JSON.parse(fs.readFileSync(ISLETS, 'utf-8'))

const baseIslandsDict = {}
baseIslands.features.forEach(baseIsland => {
  baseIslandsDict[baseIsland.properties.island_id] = baseIsland
})

const bboxChunks = BBOX_CHUNKS
  .map((bboxChunk, chunkIndex) => ({ bboxChunk, chunkIndex }))
  // .filter(chunk => chunk.chunkIndex === 1)


let currentChunkPos = 0

const next = () => {
  if (!bboxChunks[currentChunkPos]) {
    console.log('All done.')
    return
  } 
  const { bboxChunk, chunkIndex } = bboxChunks[currentChunkPos]
  console.log('Current chunk:', bboxChunk, chunkIndex)

  const islandsMetaPath = ISLANDS_META.replace('.json', `_${chunkIndex}.json`)
  const islandsMeta = JSON.parse(fs.readFileSync(islandsMetaPath, 'utf-8'))
  const allIslandsLayoutedIds = Object.keys(islandsMeta)

  const islandsLayoutedIds = allIslandsLayoutedIds
    .filter(islandLayoutedId => {
      const meta = islandsMeta[islandLayoutedId]
      if (!meta || meta.error) return false
      const center = meta.center
      return (pointWithinBBox(center, bboxChunk))
    })

  console.log('Will collect', allIslandsLayoutedIds.length)

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
    const centerMrct = turf.toMercator(turf.point(meta.center))

    const islandMrct = turf.toMercator(island)
    const transposedToCenterMrct = transposeToWorldCenter(islandMrct)
    const transposedIsland = transposeAndScale(centerMrct, transposedToCenterMrct, meta.layoutScale)
    const transposedIslandWgs84 = turf.toWgs84(transposedIsland)

    islands.push(transposedIslandWgs84)

    const islandIslets = islets.features.filter(islet => islet.properties.island_id === meta.island_id)
    // console.log('islets', islandIslets.length)
    const isletsMrct = islandIslets.map(f => turf.toMercator(f))
    const isletsTransposedToCenterMrct = isletsMrct.map(f => transposeToWorldCenter(f, islandMrct))
    const isletsTransposed = isletsTransposedToCenterMrct.map(f => transposeAndScale(centerMrct, f, meta.layoutScale))
    const isletsTransposedWgs84 = isletsTransposed.map(f => turf.toWgs84(f))
    isletsTransposedWgs84.forEach(f => {
      islands.push(f)
    })
  })

  console.log(islandsLayoutedIds.length, 'islands with', numFaulty, 'faulty')

  const path = ISLANDS.replace('.geo.json', `_${chunkIndex}.geo.json`)
  
  const transformStream = JSONStream.stringify('{"type":"FeatureCollection","features":[', '\n,\n', ']}')
  const outputStream = fs.createWriteStream(path)
  transformStream.pipe(outputStream)
  islands.forEach( transformStream.write )
  outputStream.on('finish', () => {
    console.log('Wrote', path)
    currentChunkPos++
    next()
  })
  transformStream.end()
}
next()


