#!/usr/bin/env node

const fs = require('fs')
const BOOKS_DB_PATH = './in/google-books/books_with_mid.db'
const AUTHORS_PATH = './out/db/authors.json'

let authors

const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database(BOOKS_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) console.log(err)
  db.all(`SELECT
      author,
      avg(relatedness_signal_projected_query_popularity) AS popularity,
      count(id) books_count,
      group_concat(id) ids,
      group_concat(title, '|') titles
      FROM books_with_mid
      GROUP BY author
      ORDER BY popularity DESC`, (err, rows) => {
    if (err) console.log(err)
    authors = rows
    fs.writeFileSync(AUTHORS_PATH, JSON.stringify(authors))
  })

})
