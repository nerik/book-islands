#!/usr/bin/env node

const fs = require('fs')
const Papa = require('papaparse')
const {
  BOOKS_WITHOUT_DUPLICATES_CSV,
  BOOKS_CLEANED_CSV,
  MOST_IMPORTANT_BOOKS_INFO_CSV,
} = require('../constants')

const booksFile = fs.createReadStream(BOOKS_WITHOUT_DUPLICATES_CSV)
const mostImportantBooksFile = fs.createReadStream(MOST_IMPORTANT_BOOKS_INFO_CSV)

const allBooks = []
Papa.parse(mostImportantBooksFile, {
  header: true,
  complete: function(results) {
    const mostImportantBooks = results.data
    Papa.parse(booksFile, {
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
        fs.writeFileSync(BOOKS_CLEANED_CSV, csv)
        console.log('All books cleaned')
      },
    })
  },
})
