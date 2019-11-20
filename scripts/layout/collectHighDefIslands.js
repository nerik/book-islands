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
  ISLANDS_FINAL_META,
  ISLETS,
  TERRITORY_POLYGONS,
  ISLANDS,
  ISLANDS_BBOX,
  TERRITORY_POLYGONS_HIDEF,
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

  const islandsMetaPath = ISLANDS_FINAL_META.replace('.json', `_${chunkIndex}.json`)
  const islandsMetaArray = JSON.parse(fs.readFileSync(islandsMetaPath, 'utf-8'))
  const islandsMeta = {}
  islandsMetaArray.forEach((m) => {
    islandsMeta[m.layouted_id] = m
  })
  const allIslandsLayoutedIds = Object.keys(islandsMeta)

  const territoriesPath = TERRITORY_POLYGONS.replace('.geo.json', `_${chunkIndex}.geo.json`)
  const territories = JSON.parse(fs.readFileSync(territoriesPath, 'utf-8')).features
  // console.log(territories[0])

  const islandsLayoutedIds = allIslandsLayoutedIds.filter((islandLayoutedId) => {
    const meta = islandsMeta[islandLayoutedId]
    // if (!meta || meta.error) return false
    const center = meta.center
    return pointWithinBBox(center, bboxChunk)
  })

  console.log('Will collect', allIslandsLayoutedIds.length)

  const islands = []
  const intersectedTerritories = []
  let numFaulty = 0
  const pb = progressBar(islandsLayoutedIds.length)

  islandsLayoutedIds.forEach((islandLayoutedId) => {
    pb.increment()
    const meta = islandsMeta[islandLayoutedId]
    if (meta.island_id === undefined) {
      numFaulty++
      return
    }
    // 1. Collect and transform hi def base island ------------
    const island = baseIslandsDict[meta.island_id]
    const centerMrct = turf.toMercator(turf.point(meta.center))

    const islandMrct = turf.toMercator(island)
    const transposedToCenterMrct = transposeToWorldCenter(islandMrct)
    const transposedIsland = transposeAndScale(centerMrct, transposedToCenterMrct, meta.scale)
    const transposedIslandWgs84 = turf.toWgs84(transposedIsland)

    transposedIslandWgs84.properties.layouted_id = islandLayoutedId

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
      f.properties.layouted_id = islandLayoutedId
      islands.push(f)
    })

    // 3. Collect territories and intersect them with hi def island ------
    const islandTerritories = territories.filter(
      (t) => t.properties.cluster_id === meta.layouted_id
    )
    if (islandTerritories.length) {
      // console.log(islandTerritories)
      islandTerritories.forEach((territory) => {
        const intersected = turf.intersect(territory, transposedIslandWgs84)
        if (intersected) {
          intersectedTerritories.push(intersected)
        } else {
          // WTF
          intersectedTerritories.push(territory)
        }
      })
    }
  })

  const islandsGrouped = _.groupBy(islands, 'properties.layouted_id')
  Object.entries(islandsGrouped).forEach(([id, islands]) => {
    const islandsWithIslets = turf.featureCollection(islands)
    islandsBbox[id] = turf.bbox(islandsWithIslets)
  })

  const territoryPath = TERRITORY_POLYGONS_HIDEF.replace('.geo.json', `_${chunkIndex}.geo.json`)
  fs.writeFileSync(territoryPath, JSON.stringify(turf.featureCollection(intersectedTerritories)))
  console.log('Wrote', territoryPath)

  console.log(islandsLayoutedIds.length, 'islands with', numFaulty, 'faulty')

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
