#!/usr/bin/env node

const fs = require('fs')
const getAuthorLayoutPriority = require('../util/getAuthorLayoutPriority')

const { AUTHORS, UMAP_GEO, CLUSTERS } = require('../constants')

const features = JSON.parse(fs.readFileSync(UMAP_GEO, 'utf-8')).features
const authors = JSON.parse(fs.readFileSync(AUTHORS, 'utf-8'))

// const minX = _.minBy(umap.features, d => d.geometry.coordinates[0]).geometry.coordinates[0]
// const maxX = _.maxBy(umap.features, d => d.geometry.coordinates[0]).geometry.coordinates[0]
// const minY = _.minBy(umap.features, d => d.geometry.coordinates[1]).geometry.coordinates[1]
// const maxY = _.maxBy(umap.features, d => d.geometry.coordinates[1]).geometry.coordinates[1]

// const bbox = [minX, minY, maxX, maxY]

const authorDict = {}
authors.forEach(author => {
  authorDict[author.id] = author
})

const orderedFeatures = features.map(feature => {
  const authorId = feature.properties.id
  const author = authorDict[authorId]
  // console.log(author)
  if (!author) {
    return null
  }
  return {
    ...feature,
    properties: {
      ...feature.properties,
      ...author,
      priority: getAuthorLayoutPriority(author)
    }
  }
})
  .filter(f => f !== null)
  .sort((a, b) => {
    return a.priority - b.priority
  })

console.log(orderedFeatures[10])