#!/usr/bin/env node

const fs = require('fs')
const Papa = require('papaparse')
const sqlite3 = require('sqlite3').verbose()
const { BOOKS_CSV, BOOKS_DB, BOOKS_DB_TABLE } = require('../constants')

const file = fs.createReadStream(BOOKS_CSV)
const TABLE_FIELDS = [
  { name: 'id', type: 'STRING' },
  { name: 'author_extra', type: 'STRING' },
  { name: 'birth_year', type: 'STRING' },
  { name: 'author', type: 'STRING' },
  { name: 'title', type: 'STRING' },
  { name: 'publication_year_extra', type: 'STRING' },
  { name: 'category', type: 'STRING' },
  { name: 'summary', type: 'STRING' },
  { name: 's_lang', type: 'STRING' },
  { name: 'description', type: 'STRING' },
  { name: 'd_lang', type: 'STRING' },
  { name: 'publication_city', type: 'STRING' },
  { name: 'publication_country', type: 'STRING' },
  { name: 'publication_year', type: 'STRING' },
  { name: 'isbn', type: 'STRING' },
  { name: 'mid', type: 'STRING' },
  { name: 'book_key', type: 'STRING' },
  { name: 'type', type: 'STRING' },
  { name: 'text', type: 'STRING' },
  { name: 'relatedness_signal_projected_query_popularity', type: 'STRING' },
  { name: 'cover_url', type: 'STRING' },
  { name: 'public_id', type: 'STRING' }
]

console.log('New database generation started')
if (fs.existsSync(BOOKS_DB)) {
  console.log('Deleting previous database')
  fs.unlinkSync(BOOKS_DB)
}

let db = new sqlite3.Database(BOOKS_DB, (err) => {
  if (err) {
    console.log('Error when creating the database', err)
  } else {
    console.log(`Creating database ${BOOKS_DB_TABLE} table`)
    const tableHeaders = TABLE_FIELDS.map(({ name, type }) => `${name} ${type}`).join(',')
    db.run(
      `CREATE TABLE IF NOT EXISTS ${BOOKS_DB_TABLE}(${tableHeaders})`,
      insertData
    )
  }
})

const insertData = () => {
  console.log(`Table ${BOOKS_DB_TABLE} created`)
  const fields = TABLE_FIELDS.map(({ name }) => name).join(',')
  const values = TABLE_FIELDS.map(() => '? ').join(',')
  console.log('Starting csv parsing and columns insert')
  let index = 0
  Papa.parse(file, {
    step: function(result) {
      if (index === 0) {
        index ++
        return
      }
      const cover_url = result.data[result.data.length - 1]
      var regex = /.*id=(?<id>[a-zA-Z0-9_-]*).*/gi
      var regexResults = regex.exec(cover_url)
      let publicId = regexResults && regexResults[1]
      db.run(`INSERT INTO ${BOOKS_DB_TABLE} (${fields}) VALUES (${values})`, result.data.concat(publicId))
    },
    complete: function() {
      console.log('Data import finished')
      console.log(`Closing ${BOOKS_DB}`)
      db.close()
    }
  })
}

