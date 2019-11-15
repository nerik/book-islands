#!/usr/bin/env node

/* QUERY USED TO GENERATE THE .csv in BIG QUERY
WITH books_with_cover AS (
  SELECT books.*, books_cover.url as cover_url
  FROM `cilex-books-245511.cilex_books.143k_books_with_14_categories` books
  INNER JOIN `cilex-books-245511.cilex_books.books_cover` books_cover ON books.gid = books_cover.id
 )
SELECT
  books_with_cover.gid as id, books_with_cover.category, books_with_cover.score, books_with_cover.title, books_with_cover.cover_url, books_info.author, books_info.summary, books_info.description , books_info.publication_year, books_info.publication_year_extra
FROM books_with_cover INNER JOIN `cilex-books-245511.cilex_books.290k_mid_resume` books_info ON books_with_cover.gid = books_info.id`
*/

const fs = require('fs')
const Papa = require('papaparse')
const sqlite3 = require('sqlite3').verbose()
const authorSlug = require('../util/authorSlug')
const { BOOKS_CSV, BOOKS_DB, BOOKS_DB_TABLE } = require('../constants')

const file = fs.createReadStream(BOOKS_CSV)
const TABLE_FIELDS = [
  { name: 'id', type: 'STRING' },
  { name: 'category', type: 'STRING' },
  { name: 'title', type: 'STRING' },
  { name: 'score', type: 'STRING' },
  { name: 'author', type: 'STRING' },
  { name: 'author_slug', type: 'STRING' }, // Extra field to use as slug of author and category
  { name: 'summary', type: 'STRING' },
  { name: 'description', type: 'STRING' },
  { name: 'publication_year', type: 'STRING' },
  { name: 'publication_year_extra', type: 'STRING' },
  { name: 'cover_url', type: 'STRING' },
  { name: 'public_id', type: 'STRING' }, // Extra field added in the database from the cover_url
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
    db.run(`CREATE TABLE IF NOT EXISTS ${BOOKS_DB_TABLE}(${tableHeaders})`, insertData)
  }
})

const insertData = () => {
  console.log(`Table ${BOOKS_DB_TABLE} created`)
  const fields = TABLE_FIELDS.map(({ name }) => name).join(',')
  const values = TABLE_FIELDS.map(() => '? ').join(',')
  console.log('Starting csv parsing and columns insert')
  Papa.parse(file, {
    header: true,
    step: function(result) {
      var regex = /.*id=(?<id>[a-zA-Z0-9_-]*).*/gi
      var regexResults = regex.exec(result.data.cover_url)
      let publicId = regexResults && regexResults[1]
      const resultValues = TABLE_FIELDS.map(({ name }) => {
        if (name === 'author_slug') return authorSlug(result.data)
        if (name === 'public_id') return publicId
        return result.data[name] || ''
      })
      db.run(`INSERT INTO ${BOOKS_DB_TABLE} (${fields}) VALUES (${values})`, resultValues)
    },
    complete: function() {
      console.log('Data import finished')
      console.log(`Closing ${BOOKS_DB}`)
      db.close()
    },
  })
}
