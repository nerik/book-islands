#!/usr/bin/env node

const { BOOKS_CLEANED_CSV, BOOKS_CLEANED_BY_CATEGORY_FOLDER } = require('../constants')

const Papa = require('papaparse')
const fs = require('fs')
const groupBy = require('lodash/groupBy')
const papaPromise = require('./utils/papaParser')

const normalizeMIBAuthorsCategories = async (booksPath, destinationPath) => {
  if (!fs.existsSync(destinationPath)) {
    fs.mkdirSync(destinationPath)
  }
  const allBooks = await papaPromise(booksPath)
  const booksByCategories = groupBy(allBooks, 'category')
  Object.keys(booksByCategories).forEach((category) => {
    const books = booksByCategories[category]
    fs.writeFileSync(`${destinationPath}/${category}.csv`, Papa.unparse(books))
  })
  console.log(`Categories splitted in ${Object.keys(booksByCategories).length} files`)
}

normalizeMIBAuthorsCategories(BOOKS_CLEANED_CSV, BOOKS_CLEANED_BY_CATEGORY_FOLDER)
