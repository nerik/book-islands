#!/usr/bin/env node


// First just with random coastal cities

const fs = require('fs')
const _ = require('lodash')
const turf = require('@turf/turf')

const {
  AUTHORS, CLUSTERS, ISLANDS_META, ISLANDS_LOWDEF,
  BOOKS_POINTS, TERRITORY_FRONTIERS, TERRITORY_LABELS,
  TEST_BBOX } = require('../constants')

const islands = JSON.parse(fs.readFileSync(ISLANDS_LOWDEF, 'utf-8'))
const islandsMeta = JSON.parse(fs.readFileSync(ISLANDS_META, 'utf-8'))
const clusters = JSON.parse(fs.readFileSync(CLUSTERS, 'utf-8'))
const authors = JSON.parse(fs.readFileSync(AUTHORS, 'utf-8'))

const islandsDict = {}
islands.features.forEach(island => {
  const id = island.properties.layouted_id
  islandsDict[id] = island
})

const authorsDict = {}
authors.forEach(author => {
  const id = author.id
  authorsDict[id] = author
})

const filteredClusters = clusters.features
  .filter(cluster => 
    cluster.geometry.coordinates[0] > TEST_BBOX.minX &&
    cluster.geometry.coordinates[0] < TEST_BBOX.maxX &&
    cluster.geometry.coordinates[1] > TEST_BBOX.minY &&
    cluster.geometry.coordinates[1] < TEST_BBOX.maxY
  )
// Remove errors
  .filter(cluster => {
    const layouted_id = cluster.properties.layouted_id
    const meta = islandsMeta[layouted_id]
    if (!meta || meta.error) {
      return false
    }
    return true
  })
// First just with single point islands
  .filter(cluster => {
    return cluster.properties.cluster_id === undefined
  })
// Remove clusters that somehow don't have meta
// .filter(cluster => {
//   const layouted_id = cluster.properties.layouted_id
//   const meta = islandsMeta[layouted_id]
//   return meta
// })
// // // Remove clusters that somehow don't have island
// .filter(cluster => {
//   const layouted_id = cluster.properties.layouted_id
//   const island = islandsDict[layouted_id]
//   return island
// })


const checkCity = (randomPt, cities, island) => {
  return true
}


console.log('Will do inner layout for:', filteredClusters.length)

const bookPoints = []

filteredClusters.forEach(cluster => {

  const layouted_id = cluster.properties.layouted_id
  const authorId = cluster.properties.id
  const meta = islandsMeta[layouted_id]
  const island = islandsDict[layouted_id]
  const author = authorsDict[authorId]
  // console.log(layouted_id, meta, island)

  // Collect books for author
  const booksIds = author.ids.split('|')
  const booksTitles = author.titles.split('|')
  const booksPopularities = author.popularities.split('|')
  let books = booksIds.map((book_id, i) => ({
    book_id,
    title: booksTitles[i],
    popularity: parseFloat(booksPopularities[i])
  }))

  books = _.orderBy(books, ['popularity'], ['desc'])


  // TODO collect + transpose real features

  // generate random coastal cities
  const cities = []
  if (island === undefined) {
    console.log(meta)
  }
  books.forEach(book => {
    const coords = island.geometry.coordinates[0]
    let city
    while (!city) {
      const rd = Math.floor(Math.random() * coords.length)
      const randomPt = coords[rd]
      if (checkCity(randomPt, cities, island)) {
        city = turf.point(randomPt)
        city.properties = {
          ...book,
          cluster_r: cluster.properties.cluster_r,
          cluster_g: cluster.properties.cluster_g,
          cluster_b: cluster.properties.cluster_b,
        }
      }
    }
    bookPoints.push(city)
  })
})

console.log('Created ', bookPoints.length, 'bookPoints')

fs.writeFileSync(BOOKS_POINTS, JSON.stringify(turf.featureCollection(bookPoints)))

console.log ('Wrote', BOOKS_POINTS)