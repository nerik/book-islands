#!/usr/bin/env node

const fs = require('fs')
const Papa = require('papaparse')
const {
  BOOKS_MI_MERGED_CSV,
  BOOKS_CSV,
  MOST_IMPORTANT_BOOKS_INFO_REVIEWED_FILLED_NO_DUPLICATES_CSV,
} = require('../constants')
const papaPromise = require('./utils/papaParser')

let allBooks = []
const mergeCleanedBooks = async () => {
  const mostImportantBooks = await papaPromise(
    MOST_IMPORTANT_BOOKS_INFO_REVIEWED_FILLED_NO_DUPLICATES_CSV
  )
  Papa.parse(fs.createReadStream(BOOKS_CSV), {
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
      const allBooksIds = allBooks.map((book) => book.id)
      const generetedMIBooks = mostImportantBooks.filter((book) => book.id.includes('BA_'))
      const from290kBooks = mostImportantBooks.filter(
        (book) => !book.id.includes('BA_') && !allBooksIds.includes(book.id)
      )
      allBooks = allBooks.concat(generetedMIBooks)
      allBooks = allBooks.concat(from290kBooks)
      const csv = Papa.unparse(allBooks)
      fs.writeFileSync(BOOKS_MI_MERGED_CSV, csv)
      console.log('All books cleaned')
    },
  })
}

mergeCleanedBooks()
