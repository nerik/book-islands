#!/usr/bin/env node

const fs = require('fs')
const TITLES_PATH = './out/db/titles.json'

const { BOOKS_DB, BOOKS_DB_TABLE } = require('../constants')

let bookTitles = {}

const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database(BOOKS_DB, sqlite3.OPEN_READONLY, (err) => {
  if (err) console.log(err)
  db.all(`SELECT id, title, score FROM ${BOOKS_DB_TABLE}`, (err, rows) => {
    if (err) console.log(err)
    rows.forEach((r) => {
      bookTitles[r.id] = [r.title, parseFloat(r.score)]
    })
    fs.writeFileSync(TITLES_PATH, JSON.stringify(bookTitles))
  })
})
