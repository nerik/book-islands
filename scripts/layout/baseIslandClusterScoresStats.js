#!/usr/bin/env node
const fs = require('fs')
const _ = require('lodash')
const {
  BASE_ISLANDS_CLUSTER_SCORES
} = require('../constants')

const scores = JSON.parse(fs.readFileSync(BASE_ISLANDS_CLUSTER_SCORES, 'utf-8'))


const pct = (v, t) => Math.round((v/t) * 100)
const avg = (a) => _.sum(a) / a.length

const clusterIds = Object.keys(scores)
const numClusters = clusterIds.length

console.log('total clusters:' , numClusters)

const clusters = clusterIds.map(id => ({
  scores: scores[id],
  id,
}))

const islandsPerCluster = clusters.map(c => c.scores.filter(s => s.fitScore>0).length)
console.log('avg islands per cluster', avg(islandsPerCluster))

const clusterWith0Islands = islandsPerCluster.filter(i => i === 0).length
console.log('cluster with 0 islands %:', pct(clusterWith0Islands, numClusters))

const testErr = clusters[0]