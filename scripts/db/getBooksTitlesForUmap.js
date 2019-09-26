#!/usr/bin/env node

const fs = require('fs')
const TITLES_PATH = './out/db/titles.json'

const { BOOKS_DB } = require('../constants')

let bookTitles = {}

const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database(BOOKS_DB, sqlite3.OPEN_READONLY, (err) => {
  if (err) console.log(err)
  db.all('SELECT id, title, relatedness_signal_projected_query_popularity FROM books_with_mid', (err, rows) => {
    if (err) console.log(err)
    rows.forEach(r => {
      bookTitles[r.id] = [r.title, parseFloat(r.relatedness_signal_projected_query_popularity)]
    })
    fs.writeFileSync(TITLES_PATH, JSON.stringify(bookTitles))
  })

})
