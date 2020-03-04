#!/usr/bin/env node

const fs = require('fs')
const turf = require('@turf/turf')
const _ = require('lodash')
const JSONStream = require('JSONStream')
const progressBar = require('../util/progressBar')
const transposeToWorldCenter = require('../util/transposeToWorldCenter')
const transposeAndScale = require('../util/transposeAndScale')
const pointWithinBBox = require('../util/pointWithinBBox')

const {
  BASE_ISLANDS,
  ISLETS,
  ISLANDS,
  ISLANDS_BBOX,
  ISLANDS_LOWDEF,
  BBOX_CHUNKS,
} = require('../constants')

const baseIslands = JSON.parse(fs.readFileSync(BASE_ISLANDS, 'utf-8'))
const islets = JSON.parse(fs.readFileSync(ISLETS, 'utf-8'))

const baseIslandsDict = {}
baseIslands.features.forEach((baseIsland) => {
  baseIslandsDict[baseIsland.properties.island_id] = baseIsland
})

const bboxChunks = BBOX_CHUNKS.map((bboxChunk, chunkIndex) => ({ bboxChunk, chunkIndex }))
// .filter(chunk => chunk.chunkIndex === 1)

const islandsBbox = {}
let currentChunkPos = 0

const next = () => {
  if (!bboxChunks[currentChunkPos]) {
    console.log('Writing islands bbox dictionary in', ISLANDS_BBOX)
    fs.writeFileSync(ISLANDS_BBOX, JSON.stringify(islandsBbox))
    console.log('All done.')
    return
  }
  const { bboxChunk, chunkIndex } = bboxChunks[currentChunkPos]
  console.log('Current chunk:', bboxChunk, chunkIndex)

  const islandsLowdefPath = ISLANDS_LOWDEF.replace('.geo.json', `_${chunkIndex}.geo.json`)
  const islandsLowdef = JSON.parse(fs.readFileSync(islandsLowdefPath, 'utf-8')).features

  console.log('Will collect', islandsLowdef.length)

  const islands = []
  let numFaulty = 0
  const pb = progressBar(islandsLowdef.length)

  islandsLowdef.forEach((islandLowdef) => {
    pb.increment()
    const meta = islandLowdef.properties

    // 1. Collect and transform hi def base island ------------
    const island = baseIslandsDict[meta.island_id]
    const centerMrct = turf.toMercator(meta.center)

    const islandMrct = turf.toMercator(island)
    const transposedToCenterMrct = transposeToWorldCenter(islandMrct)
    const transposedIsland = transposeAndScale(centerMrct, transposedToCenterMrct, meta.scale)
    const transposedIslandWgs84 = turf.toWgs84(transposedIsland)

    // TODO whitelist props to move to final islands
    transposedIslandWgs84.properties = { ...meta }

    islands.push(transposedIslandWgs84)

    // 2. Collect islets --------------------------------
    const islandIslets = islets.features.filter(
      (islet) => islet.properties.island_id === meta.island_id
    )
    // console.log('islets', islandIslets.length)
    const isletsMrct = islandIslets.map((f) => turf.toMercator(f))
    const isletsTransposedToCenterMrct = isletsMrct.map((f) =>
      transposeToWorldCenter(f, islandMrct)
    )
    const isletsTransposed = isletsTransposedToCenterMrct.map((f) =>
      transposeAndScale(centerMrct, f, meta.scale)
    )
    const isletsTransposedWgs84 = isletsTransposed.map((f) => turf.toWgs84(f))
    isletsTransposedWgs84.forEach((f) => {
      f.properties.islet = true
      f.properties.author_id = meta.author_id
      islands.push(f)
    })
  })

  const islandsGrouped = _.groupBy(islands, 'properties.layouted_id')
  Object.entries(islandsGrouped).forEach(([id, islands]) => {
    const islandsWithIslets = turf.featureCollection(islands)
    islandsBbox[id] = turf.bbox(islandsWithIslets)
  })

  // console.log(islandsLayoutedIds.length, 'islands with', numFaulty, 'faulty')

  const path = ISLANDS.replace('.geo.json', `_${chunkIndex}.geo.json`)

  const transformStream = JSONStream.stringify(
    '{"type":"FeatureCollection","features":[',
    '\n,\n',
    ']}'
  )
  const outputStream = fs.createWriteStream(path)
  transformStream.pipe(outputStream)
  islands.forEach(transformStream.write)
  outputStream.on('finish', () => {
    console.log('Wrote', path)
    currentChunkPos++
    pb.stop()
    next()
  })
  transformStream.end()
}
next()
