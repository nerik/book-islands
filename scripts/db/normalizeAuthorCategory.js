#!/usr/bin/env node

const {
  BOOKS_CLEANED_CSV,
  BOOKS_MI_MERGED_NO_DUPLICATES_CSV,
  MOST_IMPORTANT_BOOKS_INFO_REVIEWED_FILLED_NO_DUPLICATES_CSV,
} = require('../constants')

const Papa = require('papaparse')
const fs = require('fs')
const uniq = require('lodash/uniq')
const uniqBy = require('lodash/uniqBy')
const papaPromise = require('./utils/papaParser')

const normalizeMIBAuthorsCategories = async (booksPath, MIBPath, destinationPath) => {
  let count = 0
  const allBooks = await papaPromise(booksPath)
  const miBooks = await papaPromise(MIBPath)
  const uniqMostImportantBooksByAuthor = uniqBy(miBooks, 'author')
  const booksToUpdate = {}
  console.log('Reviewing books category updates')
  for (let i = 0; i < uniqMostImportantBooksByAuthor.length; i++) {
    const { author, category } = uniqMostImportantBooksByAuthor[i]
    const booksAuthorsMatch = allBooks.filter((book) => book.author === author)
    const uniqCategory = uniq(booksAuthorsMatch.map((book) => book.category))
    const needsReview = uniqCategory.length > 1
    if (needsReview) {
      count++
      booksAuthorsMatch.forEach((book) => {
        booksToUpdate[book.id] = category
      })
    }
  }

  console.log('Updating needed books')
  const allBooksUpdate = allBooks.map((book) => {
    const bookToUpdateCategory = booksToUpdate[book.id]
    if (bookToUpdateCategory) {
      return { ...book, category: bookToUpdateCategory }
    }
    return book
  })
  fs.writeFileSync(destinationPath, Papa.unparse(allBooksUpdate))
  console.log(`Categories by most important authors done in ${count} authors`)
}

normalizeMIBAuthorsCategories(
  BOOKS_MI_MERGED_NO_DUPLICATES_CSV,
  MOST_IMPORTANT_BOOKS_INFO_REVIEWED_FILLED_NO_DUPLICATES_CSV,
  BOOKS_CLEANED_CSV
)
