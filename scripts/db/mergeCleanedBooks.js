#!/usr/bin/env node

const fs = require('fs')
const Papa = require('papaparse')
const {
  BOOKS_WITHOUT_DUPLICATES_CSV,
  BOOKS_MI_MERGED_CSV,
  MOST_IMPORTANT_BOOKS_INFO_CSV,
} = require('../constants')
const papaPromise = require('./utils/papaParser')

const allBooks = []
const mergeCleanedBooks = async () => {
  const mostImportantBooks = await papaPromise(MOST_IMPORTANT_BOOKS_INFO_CSV)
  Papa.parse(fs.createReadStream(BOOKS_WITHOUT_DUPLICATES_CSV), {
    header: true,
    step: async function({ data }) {
      const importantBook = mostImportantBooks.find((book) => book.id === data.id)
      if (importantBook) {
        allBooks.push(importantBook)
      } else {
        allBooks.push(data)
      }
    },
    complete: function() {
      const csv = Papa.unparse(allBooks)
      fs.writeFileSync(BOOKS_MI_MERGED_CSV, csv)
      console.log('All books cleaned')
    },
  })
}

mergeCleanedBooks()
