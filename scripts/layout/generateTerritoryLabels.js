#!/usr/bin/env node

const fs = require('fs')
const _ = require('lodash')
const turf = require('@turf/turf')
const progressBar = require('../util/progressBar')
const d3 = require('d3')
const d3Arr = require('d3-array')
const avg = require('../util/avg')

const { CLUSTER_POINTS, TERRITORY_LABELS } = require('../constants')
// For now this script just produces a GeoJSON with cluster centers
// Later, it should compute territory center
// Later, it should generate lines to write along

const clusterPoints = JSON.parse(fs.readFileSync(CLUSTER_POINTS, 'utf-8')).features

const maxSumPop = _.maxBy(clusterPoints, p => p.properties.sum_popularity).properties.sum_popularity
const avgSumPop = avg(clusterPoints.map(p => p.properties.sum_popularity))

console.log('max:', maxSumPop)
console.log('avg', avgSumPop)

const BINS = [0, 1, 200, 5000]
console.log('bins used', BINS)

const binner = d3Arr.bin()
  .value(d => d.properties.sum_popularity)
  // .thresholds(5)
  .thresholds([0, 1, 200, 5000])
const bins = binner(clusterPoints)

console.log('Distribution', bins.map(b => b.length))

const scale = d3.scaleThreshold()
  .domain(BINS)
  .range([4,4,3,2,1])

const byRank = {} 
const allFeatures = []
clusterPoints.forEach(p => {
  const feature = {...p}
  // TODO p.properties.sum_popularity is sometimes undefined :/
  const rank = scale(p.properties.sum_popularity)
  feature.properties = {
    rank,
    label: p.properties.id,
  }
  // console.log(p.properties.sum_popularity, rank)
  if (!byRank[rank]) {
    byRank[rank] = []
  }
  byRank[rank].push(feature)
  allFeatures.push(feature)
})

// Object.keys(byRank).forEach(rank => {
//   const p = `${TERRITORY_LABELS}_${rank}`
//   fs.writeFileSync(p, JSON.stringify(turf.featureCollection(byRank[rank])))
//   console.log ('Wrote', p)
// })
fs.writeFileSync(TERRITORY_LABELS, JSON.stringify(turf.featureCollection(allFeatures)))
console.log ('Wrote', TERRITORY_LABELS)

