#!/usr/bin/env node

const fs = require('fs')
const BOOKS_DB_PATH = './in/google-books/books.db'

const { BOOKS_DB_TABLE, AUTHORS } = require('../constants')

let authors

const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database(BOOKS_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) console.log('Error openingdb:', err)
  db.all(
    `
    SELECT
      id,
      author,
      author_slug,
      sum(score) AS sum_popularity,
      avg(score) AS avg_popularity,
      count(id) books_count,
      group_concat(id, '|') ids,
      group_concat(title, '|') titles,
      group_concat(score, '|') popularities
      FROM ${BOOKS_DB_TABLE}
      GROUP BY author_slug
      ORDER BY sum_popularity DESC`,
    (err, rows) => {
      if (err) console.log('Error reading rows', err)
      authors = rows
      fs.writeFileSync(AUTHORS, JSON.stringify(authors))
      console.log('Wrote to', AUTHORS)
    }
  )
})
