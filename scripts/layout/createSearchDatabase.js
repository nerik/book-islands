#!/usr/bin/env node
const fs = require('fs')
const csvStringify = require('csv-stringify/lib/sync')

const IN = '../../out/points-author.geo.json'
const OUT = './app/search-db.csv'

const authors = require(IN)

const trunc = (n) => {
  const numDecimals = 4
  const mult = Math.pow(10, numDecimals)
  return Math.round(n * mult) / mult
}

const authorsRecords = [['author', 'lng', 'lat']].concat(
  authors.features.map(author => {
    return [
      author.properties.id,
      trunc(author.geometry.coordinates[0]),
      trunc(author.geometry.coordinates[1])
    ]
  })
)

const csv = csvStringify(authorsRecords)
fs.writeFileSync(OUT, csv)