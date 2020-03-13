#!/usr/bin/env node
const fs = require('fs')
const _ = require('lodash')
const csvStringify = require('csv-stringify/lib/sync')

const {
  BOOKS_POINTS,
  ISLANDS_BBOX_BY_SLUG,
  ISLAND_LABELS,
  SEARCH_BOOKS_DB,
  SEARCH_BOOKS_DB_RANKED,
  SEARCH_DB,
  SEARCH_DB_RANKED,
  SEARCH_DB_BOOKS_RANKED_LIMIT,
  SEARCH_DB_AUTHORS_RANKED_LIMIT,
} = require('../constants')

const authors = JSON.parse(fs.readFileSync(ISLAND_LABELS, 'utf-8')).features
const islandsBbox = JSON.parse(fs.readFileSync(ISLANDS_BBOX_BY_SLUG, 'utf-8'))
const books = JSON.parse(fs.readFileSync(BOOKS_POINTS, 'utf-8')).features

const trunc = (n) => {
  const numDecimals = 4
  const mult = Math.pow(10, numDecimals)
  return Math.round(n * mult) / mult
}

const fallbackCoordinatesMargin = 0.01
const parseAuthor = (author) => {
  const authorBbox = islandsBbox[author.properties.slug]
  const [longitude, latitude] = author.geometry.coordinates
  const coordinates = authorBbox
    ? [...authorBbox.map(trunc)]
    : [
        trunc(longitude) - fallbackCoordinatesMargin,
        trunc(latitude) - fallbackCoordinatesMargin,
        trunc(longitude) + fallbackCoordinatesMargin,
        trunc(latitude) + fallbackCoordinatesMargin,
      ]
  return [author.properties.id, author.properties.rank, ...coordinates]
}

const parseBook = (book) => {
  return [
    book.properties.title,
    book.properties.book_id,
    trunc(book.geometry.coordinates[0]),
    trunc(book.geometry.coordinates[1]),
  ]
}

const authorCsvFields = ['author', 'rank', 'minX', 'minY', 'maxX', 'maxY']
const bookCsvFields = ['book', 'id', 'lng', 'lat']

const authorsRecords = [authorCsvFields].concat(
  authors.filter((author) => author.properties.rank < 4).map(parseAuthor)
)

const rankedAuthorRecords = [authorCsvFields].concat(
  _.uniqBy(_.orderBy(authors, 'properties.popularity', 'desc'), 'properties.id')
    .slice(0, SEARCH_DB_AUTHORS_RANKED_LIMIT)
    .map(parseAuthor)
)

const booksRecords = [bookCsvFields].concat(
  books.filter((book) => book.properties.rank < 4).map(parseBook)
)
const rankedBooksRecords = [bookCsvFields].concat(
  _.uniqBy(_.orderBy(books, 'properties.rank', 'desc'), 'properties.book_id')
    .slice(0, SEARCH_DB_BOOKS_RANKED_LIMIT)
    .map(parseBook)
)

console.log('Author records')
console.log(authorsRecords.length, ' authors records')
console.log(rankedAuthorRecords.length, 'ranked authors records')

console.log('Books records')
console.log(booksRecords.length, 'books records')
console.log(rankedBooksRecords.length, 'ranked books records')

const authorCsv = csvStringify(authorsRecords)
const authorCsvRanked = csvStringify(rankedAuthorRecords)
const booksCsv = csvStringify(booksRecords)
const booksCsvRanked = csvStringify(rankedBooksRecords)
fs.writeFileSync(SEARCH_DB, authorCsv)
fs.writeFileSync(SEARCH_DB_RANKED, authorCsvRanked)
fs.writeFileSync(SEARCH_BOOKS_DB, booksCsv)
fs.writeFileSync(SEARCH_BOOKS_DB_RANKED, booksCsvRanked)

console.log('Wrote authors and books search db')
