#!/usr/bin/env node

const fs = require('fs')
const progressBar = require('../util/progressBar')

const { BOOKS_DB, BOOKS_DB_TABLE, BOOKS_JSON } = require('../constants')

const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database(BOOKS_DB, sqlite3.OPEN_READONLY, (err) => {
  if (err) console.log(err)
  db.all(`SELECT *, id || '' as id FROM ${BOOKS_DB_TABLE}`, (err, rows) => {
    const pb = progressBar(rows.length)
    if (err) console.log(err)
    rows.forEach((row) => {
      fs.writeFileSync(`${BOOKS_JSON}/${row.id}.json`, JSON.stringify(row))
      pb.increment()
    })
  })
})
