#!/usr/bin/env node

const fs = require('fs')
const BOOKS_DB_PATH = './in/google-books/books_with_mid.db'

const { AUTHORS } = require('../constants')

let authors

const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database(BOOKS_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) console.log('Error openingdb:',err)
  db.all(`SELECT
      author as id,
      sum(relatedness_signal_projected_query_popularity) AS sum_popularity,
      avg(relatedness_signal_projected_query_popularity) AS avg_popularity,
      count(id) books_count,
      group_concat(id, '|') ids,
      group_concat(title, '|') titles,
      group_concat(relatedness_signal_projected_query_popularity, '|') popularities
      FROM books_with_mid
      GROUP BY author
      ORDER BY sum_popularity DESC`, (err, rows) => {
    if (err) console.log('Error reading rows', err)
    authors = rows
    fs.writeFileSync(AUTHORS, JSON.stringify(authors))
    console.log('Wrote to', AUTHORS)
  })

})
