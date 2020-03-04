#!/usr/bin/env node

const fs = require('fs')
const turf = require('@turf/turf')
const supercluster = require('supercluster')
const getAuthorLayoutPriority = require('../util/getAuthorLayoutPriority')
const randomColor = require('../util/randomColor')

const { AUTHORS, UMAP_GEO, UMAP_CAT_META, POINTS, TEST_BBOX } = require('../constants')

const allfeatures = JSON.parse(fs.readFileSync(UMAP_GEO, 'utf-8')).features
const authors = JSON.parse(fs.readFileSync(AUTHORS, 'utf-8'))
const umapsMeta = JSON.parse(fs.readFileSync(UMAP_CAT_META, 'utf-8'))

const features = allfeatures.filter(
  (feature) =>
    feature.geometry.coordinates[0] > TEST_BBOX.minX &&
    feature.geometry.coordinates[0] < TEST_BBOX.maxX &&
    feature.geometry.coordinates[1] > TEST_BBOX.minY &&
    feature.geometry.coordinates[1] < TEST_BBOX.maxY
)

const authorDict = {}
authors.forEach((author) => {
  authorDict[author.author_slug] = author
})

const authorsInUmapNotInDB = []
const orderedFeatures = features
  .map((feature) => {
    const { author_slug } = feature.properties
    const author = authorDict[author_slug]
    if (!author) {
      authorsInUmapNotInDB.push(author_slug)
      console.log('Author exist in UMAP but not in DB:', author_slug)
      return null
    }
    return {
      ...feature,
      properties: {
        ...feature.properties,
        ...author,
        priority: getAuthorLayoutPriority(author),
      },
    }
  })
  .filter((f) => f !== null)

orderedFeatures.sort((a, b) => {
  return b.properties.priority - a.properties.priority
})

console.log('Standalone total points', orderedFeatures.length)
console.log(authorsInUmapNotInDB.length, 'authors are in umap output but not in DB')

const INITIAL_GEO_ZOOM = 9
const bbox = [TEST_BBOX.minX, TEST_BBOX.minY, TEST_BBOX.maxX, TEST_BBOX.maxY]
const supercl = new supercluster({
  radius: 150,
  maxZoom: 16,
})
supercl.load(orderedFeatures)

// Get cluster and leave out supercluster-generated standalone points
const clusters = supercl.getClusters(bbox, INITIAL_GEO_ZOOM).filter((c) => c.properties.cluster_id)

console.log(clusters.length, 'clusters')

clusters.forEach((cluster) => {
  const superclusterId = cluster.properties.cluster_id
  const leaves = supercl.getLeaves(superclusterId, Infinity).map((l) => l.properties.author_id)
  // Create supercluster cluster point
  const superclusterChildren = orderedFeatures.filter((pt) =>
    leaves.includes(pt.properties.author_id)
  )
  let superclusterImportantChild
  let superclusterImportantChildMaxPriority = -Infinity
  superclusterChildren.forEach((superclusterChild) => {
    if (superclusterChild.properties.priority > superclusterImportantChildMaxPriority) {
      superclusterImportantChildMaxPriority = superclusterChild.properties.priority
      superclusterImportantChild = superclusterChild
    }
  })
  superclusterImportantChild.properties.children = superclusterChildren.map(
    (f) => f.properties.author_id
  )
  superclusterImportantChild.properties.children_count = superclusterChildren.length
  const col = randomColor()
  superclusterChildren.forEach((c) => {
    c.properties = { ...c.properties, ...col }
  })
})

fs.writeFileSync(POINTS, JSON.stringify(turf.featureCollection(orderedFeatures)))
console.log('Wrote ', POINTS)
