#!/usr/bin/env node
const fs = require('fs')
const turf = require('@turf/turf')
const _ = require('lodash')
const polylabel = require('../util/polylabel')

const {
  AUTHORS,
  ISLANDS_FINAL_META,
  ISLANDS_LOWDEF,
  TERRITORY_POLYGONS,
  TERRITORY_LABELS,
  BOOKS_POINTS,
  TERRITORIES_RANK_SCALE,
  BBOX_CHUNKS,
  CITIES_RANK_SCALE,
} = require('../constants')

const authors = JSON.parse(fs.readFileSync(AUTHORS, 'utf-8'))
const authorsDict = {}
authors.forEach((author) => {
  const { author_slug } = author
  authorsDict[author_slug] = author
})

const getAuthors = (ids) => {
  const authors = ids.map((id) => authorsDict[id])
  // _.compact remove potential null authors (L Ron Hubbard)
  return _.compact(authors)
}

// Checks if random point is not too close to another city
const isCityIsolatedEnough = (city, cities) => {
  cities.forEach((otherCity) => {
    const dist = turf.distance(city, otherCity, { units: 'kilometers' })
    if (dist < 2) {
      return false
    }
  })
  return true
}

const checkCityInTerritory = (pt, territory = null) => {
  try {
    if (territory === null) {
      return true
    }
    return turf.booleanPointInPolygon(pt, territory)
  } catch (e) {
    console.error(e)
    console.log('pt', pt)
    console.log('territory', territory)
    return false
  }
}

const getBooks = (author) => {
  const booksIds = author.ids.split('|')
  const booksTitles = author.titles.split('|')
  const booksPopularities = author.popularities.split('|')
  const books = booksIds.map((book_id, i) => ({
    book_id,
    title: booksTitles[i],
    popularity: parseFloat(booksPopularities[i]),
  }))
  return _.orderBy(books, ['popularity'], ['desc'])
}

const territoryLabels = []
const bookPoints = []
BBOX_CHUNKS.forEach((bboxChunk, chunkIndex) => {
  console.log('Current chunk:', bboxChunk, chunkIndex)
  // Load meta to get base islands ids and transformations that need to be applied (scale+center)
  const finalMetasPath = ISLANDS_FINAL_META.replace('.json', `_${chunkIndex}.json`)
  const finalMetas = JSON.parse(fs.readFileSync(finalMetasPath, 'utf-8'))
  // Load layouted islands in low def to compute island centers and get coastal points
  const islandsPath = ISLANDS_LOWDEF.replace('.geo.json', `_${chunkIndex}.geo.json`)
  const islands = JSON.parse(fs.readFileSync(islandsPath, 'utf-8')).features
  // Load territories to compute territory centers
  const territoriesPath = TERRITORY_POLYGONS.replace('.geo.json', `_${chunkIndex}.geo.json`)
  const territories = JSON.parse(fs.readFileSync(territoriesPath, 'utf-8')).features

  console.log('Has', finalMetas.length, 'islands')

  finalMetas.forEach((finalMeta) => {
    const layoutedId = finalMeta.layouted_id
    let polygons = []
    let authorsIds = []
    const island = islands.find((i) => i.properties.layouted_id === layoutedId)
    if (!island) {
      console.log('Island not found', layoutedId)
      return
    }
    if (finalMeta.is_cluster === true) {
      polygons = territories.filter((t) => t.properties.cluster_id === layoutedId)
      authorsIds = polygons.map((p) => p.properties.author_id)
    } else {
      polygons = [island]
      authorsIds = [island.properties.author_id]
    }

    // console.log(polygons, authorsIds)
    // console.log('---')
    const authors = getAuthors(authorsIds)

    const authorsBooks = authors.map((author) => ({
      author,
      books: getBooks(author),
    }))

    authorsBooks.forEach((authorBooks, i) => {
      // generate polygon center
      const authorPop = authorBooks.author.sum_popularity
      const territory = polygons[i]

      const labelCenterPt =
        territory.geometry.type === 'Polygon'
          ? turf.point(polylabel(territory.geometry.coordinates))
          : turf.centroid(territory)

      labelCenterPt.properties.id = authorBooks.author.id
      labelCenterPt.properties.slug = authorBooks.author.author_slug
      labelCenterPt.properties.popularity = Math.round(authorBooks.author.sum_popularity)
      labelCenterPt.properties.rank = TERRITORIES_RANK_SCALE(authorPop)
      territoryLabels.push(labelCenterPt)

      // generate available points for terr
      // TODO sort "real" points (cities, peaks etc) by territory
      // TODO take "real" points (cities, peaks etc) points randomly until exhausted
      const territoryCoastalPoints = island.geometry.coordinates[0].filter((coords) => {
        return checkCityInTerritory(coords, territory)
      })
      const territoryBbox = turf.bbox(territory)

      const islandCities = []
      authorBooks.books.forEach((book) => {
        // generate available points for territory
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
            // console.log('no more coastal pts')
            const randomPt = turf.randomPoint(1, { bbox: territoryBbox }).features[0]
            try {
              if (
                turf.booleanPointInPolygon(randomPt, territory) &&
                isCityIsolatedEnough(randomPt, islandCities)
              ) {
                // console.log('adding rd pt')
                city = randomPt
              }
            } catch (e) {
              console.warn(e)
              console.log('randomPt', randomPt)
              console.log('territory', territory)
              city = randomPt
            }
          }
        }
        islandCities.push(city)
        const rank = CITIES_RANK_SCALE(book.popularity)
        city.properties = {
          title: book.title,
          book_id: book.book_id,
          rank,
          // remove below for final dataset
          author_id: authorBooks.author.id,
          // cluster_r: cluster.properties.cluster_r,
          // cluster_g: cluster.properties.cluster_g,
          // cluster_b: cluster.properties.cluster_b,
        }
        bookPoints.push(city)
      })
    })
  })
})

console.log('Created ', territoryLabels.length, 'territory labels - with distribution:')
console.log('1:', territoryLabels.filter((f) => f.properties.rank === 1).length)
console.log('2:', territoryLabels.filter((f) => f.properties.rank === 2).length)
console.log('3:', territoryLabels.filter((f) => f.properties.rank === 3).length)
console.log('4:', territoryLabels.filter((f) => f.properties.rank === 4).length)

console.log('Created ', bookPoints.length, 'bookPoints - with distribution')
console.log('1:', bookPoints.filter((f) => f.properties.rank === 1).length)
console.log('2:', bookPoints.filter((f) => f.properties.rank === 2).length)
console.log('3:', bookPoints.filter((f) => f.properties.rank === 3).length)
console.log('4:', bookPoints.filter((f) => f.properties.rank === 4).length)

fs.writeFileSync(TERRITORY_LABELS, JSON.stringify(turf.featureCollection(territoryLabels)))
fs.writeFileSync(BOOKS_POINTS, JSON.stringify(turf.featureCollection(bookPoints)))
console.log('Wrote', TERRITORY_LABELS)
console.log('Wrote', BOOKS_POINTS)
