#!/usr/bin/env node

// get umaps bbox and normalize all of them (keeping their relative scale)
// generate basic clusters + colors + names

const fs = require('fs')
const path = require('path')
const d3 = require('d3')
const _ = require('lodash')
const turf = require('@turf/turf')
const parse = require('csv-parse/lib/sync')
const Supercluster = require('supercluster')

const { UMAP_CAT, UMAP_CAT_STATS } = require('../constants')

const umapCatsPaths = fs.readdirSync(UMAP_CAT).filter((p) => p !== '.DS_Store')

const rdChan = () => Math.floor(Math.random() * 255)
const rdCol = () => `rgb(${rdChan()},${rdChan()},${rdChan()})`

const umapCats = umapCatsPaths.map((p) => {
  const csv = fs.readFileSync(path.join(UMAP_CAT, p), 'utf-8')
  const nodes = parse(csv, {
    columns: ['id', 'x', 'y'],
  })
  nodes.forEach((r) => {
    r.x = parseFloat(r.x)
    r.y = parseFloat(r.y)
  })

  const xMin = _.minBy(nodes, (r) => r.x).x
  const yMin = _.minBy(nodes, (r) => r.y).y
  const xMax = _.maxBy(nodes, (r) => r.x).x
  const yMax = _.maxBy(nodes, (r) => r.y).y

  return {
    name: p.replace('UMAP_cat_', '').replace('.csv', ''),
    nodes,
    bbox: [xMin, yMin, xMax, yMax],
  }
  // const color = rdCol()
  // // const clusters =
})

const maxBBox = [
  _.minBy(umapCats, (c) => c.bbox[0]).bbox[0],
  _.minBy(umapCats, (c) => c.bbox[1]).bbox[1],
  _.maxBy(umapCats, (c) => c.bbox[2]).bbox[2],
  _.maxBy(umapCats, (c) => c.bbox[3]).bbox[3],
]

const MIN_LNG = -180
const MAX_LNG = 180
const MIN_LAT = -80
const MAX_LAT = 80

const lng = d3
  .scaleLinear()
  .domain([maxBBox[0], maxBBox[2]])
  .range([MIN_LNG, MAX_LNG])

const lat = d3
  .scaleLinear()
  .domain([maxBBox[1], maxBBox[3]])
  .range([MAX_LAT, MIN_LAT])

const umapCatsClusters = umapCats.map((umapCat) => {
  const points = umapCat.nodes.map((node) => {
    const point = turf.point([lng(node.x), lat(node.y)])
    point.properties = {}
    return point
  })
  const fc = turf.featureCollection(points)
  const index = new Supercluster({
    radius: 1000,
    minZoom: 8,
    maxZoom: 8,
  })
  index.load(fc.features)
  let clusters = index.getClusters(turf.bbox(fc), 2)
  clusters.forEach((c) => {
    if (c.properties.cluster_id === undefined) {
      c.properties.point_count = 1
    }
  })
  return {
    name: umapCat.name,
    color: rdCol(),
    count: umapCat.nodes.length,
    clusters,
  }
})

fs.writeFileSync(UMAP_CAT_STATS, JSON.stringify(umapCatsClusters))

console.log('Wrote', UMAP_CAT_STATS)
