#!/usr/bin/env node
const fs = require('fs')
const csvStringify = require('csv-stringify/lib/sync')

const {
  TERRITORY_LABELS, SEARCH_DB
} = require('../constants')

const authors = JSON.parse(fs.readFileSync(TERRITORY_LABELS, 'utf-8')).features

const trunc = (n) => {
  const numDecimals = 4
  const mult = Math.pow(10, numDecimals)
  return Math.round(n * mult) / mult
}

const authorsRecords = [['author', 'lng', 'lat']].concat(
  authors
    .filter(author => author.properties.rank < 4)
    .map(author => {
      return [
        author.properties.id,
        trunc(author.geometry.coordinates[0]),
        trunc(author.geometry.coordinates[1])
      ]
    })
)

console.log(authorsRecords.length, 'records')

const csv = csvStringify(authorsRecords)
fs.writeFileSync(SEARCH_DB, csv)

console.log('Wrote', SEARCH_DB)