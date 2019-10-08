#!/usr/bin/env node


// First just with random coastal cities

const fs = require('fs')
const _ = require('lodash')
const turf = require('@turf/turf')
const getClusterTerritories = require('./util/getClusterTerritories')

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
  // Remove clustered points (but keep clusters + standalone points)
  .filter(cluster => {
    return cluster.properties.is_cluster || cluster.properties.cluster_id === undefined
  })
  // Remove errors
  .filter(cluster => {
    const layouted_id = cluster.properties.layouted_id
    const meta = islandsMeta[layouted_id]
    if (/*!meta || */meta.error) {
      return false
    }
    return true
  })
// First just with single point islands
  // .filter(cluster => {
  //   return cluster.properties.cluster_id !== undefined
  // })

// Checks if random point is not too close to another city
const checkRandomCity = (randomPt, cities) => {
  return true
}

const checkCityInTerritory = (pt, territory = null) => {
  if (territory === null) {
    return true
  }
  return turf.booleanPointInPolygon(pt, territory)
}

const getBooks = (author) => {
  const booksIds = author.ids.split('|')
  const booksTitles = author.titles.split('|')
  const booksPopularities = author.popularities.split('|')
  const books = booksIds.map((book_id, i) => ({
    book_id,
    title: booksTitles[i],
    popularity: parseFloat(booksPopularities[i])
  }))
  return _.orderBy(books, ['popularity'], ['desc'])
}

const numClusters = filteredClusters.filter(c => c.properties.is_cluster).length

console.log('Will do inner layout for:', filteredClusters.length, 'islands')
console.log('Will do inner layout for:', numClusters, ' clusters')

let numClustersSucceeded = 0
let numClustersDone = 0
const bookPoints = []
const allTerritories = []
filteredClusters.forEach(cluster => {

  const layouted_id = cluster.properties.layouted_id
  const meta = islandsMeta[layouted_id]
  const island = islandsDict[layouted_id]

  let authors
  let territories = []
  if (cluster.properties.is_cluster === true) {
    // collect cluster points
    const clusterId = cluster.properties.cluster_id
    const clusterPoints = clusters.features.filter(f => f.properties.cluster_id === clusterId)

    const authorIds = cluster.properties.cluster_leaves
    authors = authorIds.map(authorId => authorsDict[authorId])

    // for now just generate "dirty" territories ovelapping islands
    // will then have to generate "borders"
    const clusterWeights = clusterPoints.map(p => 1)
    console.log('Clustering:', numClustersDone, '/', numClusters)
    // console.log(JSON.stringify(turf.featureCollection(clusterPoints)))
    // console.log(JSON.stringify(island))

    const NUM_TRIES = 20
    for (let i = 0; i <= NUM_TRIES; i++) {
      try {
        territories = getClusterTerritories(clusterPoints, clusterWeights, island)
        territories.forEach((territory, i) => {
          territory.properties = {
            ...clusterPoints[i].properties
          }
          allTerritories.push(territory)
        })
        console.log('succeeded for', numClustersDone)
        numClustersSucceeded++
        break
      } catch (e) {
        console.log(e)
        console.log('failed')
      }
      if (i === NUM_TRIES) {
        console.log('failed for', numClustersDone)
      }
    }
    numClustersDone++
  } else {
    const authorId = cluster.properties.id
    authors = [authorsDict[authorId]]
  }
  // console.log(layouted_id, meta, island)

  // Collect books for author
  const authorsBooks = authors.map(author => ({
    author: author.id,
    books: getBooks(author)
  }))

  authorsBooks.forEach((authorBooks, i) => {
    // // TODO collect + transpose real features (+ use checkCityInTerritory)
    // generate random coastal cities
    const cities = []
    if (island === undefined) {
      console.log(meta)
    }
    authorBooks.books.forEach(book => {
      const coords = island.geometry.coordinates[0]
      let city
      let tries = 0
      while (!city) {
        tries++
        const rd = Math.floor(Math.random() * coords.length)
        const randomPt = coords[rd]
        if (!checkRandomCity(randomPt, cities) || !checkCityInTerritory(randomPt, territories[i])) {
          if (tries < 100) {
            continue
          } else {
            console.log('Cant fit cities in this terriotery')
          }
        }
        city = turf.point(randomPt)
        city.properties = {
          ...book,
          // remove below for final dataset
          author: authorBooks.author,
          cluster_r: cluster.properties.cluster_r,
          cluster_g: cluster.properties.cluster_g,
          cluster_b: cluster.properties.cluster_b,
        }
      }
      bookPoints.push(city)
    })
  })
})

console.log('Created ', bookPoints.length, 'bookPoints')
console.log('Created ', allTerritories.length, 'territories')

fs.writeFileSync(BOOKS_POINTS, JSON.stringify(turf.featureCollection(bookPoints)))
fs.writeFileSync(TERRITORY_FRONTIERS, JSON.stringify(turf.featureCollection(allTerritories)))

console.log ('Wrote', BOOKS_POINTS)
console.log ('Wrote', TERRITORY_FRONTIERS)