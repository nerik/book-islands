#!/usr/bin/env node
const fs = require('fs')
const _ = require('lodash')
const csvStringify = require('csv-stringify/lib/sync')

const {
  TERRITORY_LABELS,
  SEARCH_DB,
  SEARCH_DB_RANKED,
  SEARCH_DB_RANKED_LIMIT
} = require('../constants')

const authors = JSON.parse(fs.readFileSync(TERRITORY_LABELS, 'utf-8')).features

const trunc = (n) => {
  const numDecimals = 4
  const mult = Math.pow(10, numDecimals)
  return Math.round(n * mult) / mult
}

const parseAuthor = (author) => {
  return [
    author.properties.id,
    author.properties.rank,
    trunc(author.geometry.coordinates[0]),
    trunc(author.geometry.coordinates[1])
  ]
}

const csvFields = ['author', 'rank', 'lng', 'lat']

const authorsRecords = [csvFields].concat(
  authors.filter((author) => author.properties.rank < 4).map(parseAuthor)
)

const rankedAuthorRecords = [csvFields].concat(
  _.uniqBy(_.orderBy(authors, 'properties.popularity', 'desc'), 'properties.id')
    .slice(0, SEARCH_DB_RANKED_LIMIT)
    .map(parseAuthor)
)

console.log(authorsRecords.length, 'records')
console.log(rankedAuthorRecords.length, 'records')

const csv = csvStringify(authorsRecords)
const csvRanked = csvStringify(rankedAuthorRecords)
fs.writeFileSync(SEARCH_DB, csv)
fs.writeFileSync(SEARCH_DB_RANKED, csvRanked)

console.log('Wrote', SEARCH_DB)
console.log('Wrote', SEARCH_DB_RANKED)
