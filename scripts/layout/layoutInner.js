#!/usr/bin/env node


const fs = require('fs')
const { performance } = require('perf_hooks')
const _ = require('lodash')
const turf = require('@turf/turf')
const d3 = require('d3')
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
const isCityIsolatedEnough = (city, cities) => {
  cities.forEach(otherCity => {
    const dist = turf.distance(city, otherCity, {units: 'kilometers'})
    if (dist < 2) {
      return false
    }
  })
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


// compute territories / cities ranks bins 
const citiesRankScale = d3.scaleThreshold()
  .domain([0, 1, 100, 1000])
  .range([4,4,3,2,1])

const territoriesRankScale = d3.scaleThreshold()
  .domain([0, 1, 200, 2000])
  .range([4,4,3,2,1])


const numClusters = filteredClusters.filter(c => c.properties.is_cluster).length

console.log('Will do inner layout for:', filteredClusters.length, 'islands')
console.log('Will do inner layout for:', numClusters, ' clusters')
const t = performance.now()


let numClustersDone = 0
let numClustersSucceeded = 0
const bookPoints = []
const allTerritories = []
const territoryLabels = []

filteredClusters.forEach(cluster => {
  const layouted_id = cluster.properties.layouted_id
  // const meta = islandsMeta[layouted_id]
  const island = islandsDict[layouted_id]

  let authors
  let territories = []
  if (cluster.properties.is_cluster === true) {
    // collect cluster points
    const clusterId = cluster.properties.cluster_id
    const clusterPoints = clusters.features
      .filter(f => f.properties.is_cluster === false &&f.properties.cluster_id === clusterId)

    authors = clusterPoints.map(p => authorsDict[p.properties.id])

    // for now just generate "dirty" territories ovelapping islands
    // will then have to generate "borders"
    const clusterWeights = clusterPoints.map(p => 1)
    console.log('Clustering:', numClustersDone, '/', numClusters)
    const NUM_TRIES = 10
    for (let i = 0; i <= NUM_TRIES; i++) {
      try {
        territories = getClusterTerritories(clusterPoints, clusterWeights, island)
        territories.forEach((territory, i) => {
          territory.properties = {
            id: clusterPoints[i].properties.id,
            cluster_r: clusterPoints[i].properties.cluster_r,
            cluster_g: clusterPoints[i].properties.cluster_g,
            cluster_b: clusterPoints[i].properties.cluster_b,
          }
          allTerritories.push(territory)
        })
        console.log('succeeded for', numClustersDone)
        numClustersSucceeded++
        break
      } catch (e) {
        // console.log(e.message)
        // console.log('failed')
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
    author,
    books: getBooks(author)
  }))

  authorsBooks.forEach((authorBooks, i) => {
    // generate polygon center
    const authorPop = authorBooks.author.sum_popularity
    const territory = territories[i] || island
    const labelCenter = turf.centroid(territory)
    labelCenter.properties.id = authorBooks.author.id
    labelCenter.properties.rank = territoriesRankScale(authorPop)
    territoryLabels.push(labelCenter)


    // generate available points for terr
    // TODO sort real points by territory
    // TODO take real points randomly until exhausted
    const territoryCoastalPoints = island.geometry.coordinates[0].filter(coords => {
      return checkCityInTerritory(coords, territory)
    })
    const territoryBbox = turf.bbox(territory)

    
    const islandCities = []
    // if (island === undefined) {
    //   // console.log(meta)
    // }
    authorBooks.books.forEach(book => {
      let city
      while (!city) {
        if (territoryCoastalPoints.length) {
          const rd = Math.floor(Math.random() * territoryCoastalPoints.length)
          const randomPt = turf.point(territoryCoastalPoints.splice(rd, 1)[0])
          if (isCityIsolatedEnough(randomPt, islandCities)) {
            // console.log('adding coastal pt')
            city = randomPt
          }
        } else {
          // console.log('no more coastal pt')
          const randomPt = turf.randomPoint(1, { bbox: territoryBbox }).features[0]
          if (turf.booleanPointInPolygon(randomPt, territory) && isCityIsolatedEnough(randomPt, islandCities)) {
            // console.log('adding rd pt')
            city = randomPt
          }
        }
      }
      islandCities.push(city)
      const rank = citiesRankScale(book.popularity)
      city.properties = {
        ...book,
        rank,
        // remove below for final dataset
        author_id: authorBooks.author.id,
        cluster_r: cluster.properties.cluster_r,
        cluster_g: cluster.properties.cluster_g,
        cluster_b: cluster.properties.cluster_b,
      }
      bookPoints.push(city)
    })
  })
})
console.log('Done in', Math.round((performance.now() - t) / 1000), 's')

console.log('Cluster success ', numClustersSucceeded, '/', numClustersDone)

console.log('Created ', allTerritories.length, 'territories')

console.log('Created ', bookPoints.length, 'bookPoints - with distribution')
console.log('1:', bookPoints.filter(f => f.properties.rank === 1).length)
console.log('2:', bookPoints.filter(f => f.properties.rank === 2).length)
console.log('3:', bookPoints.filter(f => f.properties.rank === 3).length)
console.log('4:', bookPoints.filter(f => f.properties.rank === 4).length)

console.log('Created ', territoryLabels.length, 'territory labels - with distribution:')
console.log('1:', territoryLabels.filter(f => f.properties.rank === 1).length)
console.log('2:', territoryLabels.filter(f => f.properties.rank === 2).length)
console.log('3:', territoryLabels.filter(f => f.properties.rank === 3).length)
console.log('4:', territoryLabels.filter(f => f.properties.rank === 4).length)

fs.writeFileSync(TERRITORY_LABELS, JSON.stringify(turf.featureCollection(territoryLabels)))
fs.writeFileSync(BOOKS_POINTS, JSON.stringify(turf.featureCollection(bookPoints)))
fs.writeFileSync(TERRITORY_FRONTIERS, JSON.stringify(turf.featureCollection(allTerritories)))

console.log ('Wrote', TERRITORY_LABELS)
console.log ('Wrote', BOOKS_POINTS)
console.log ('Wrote', TERRITORY_FRONTIERS)