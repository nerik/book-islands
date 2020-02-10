#!/usr/bin/env node

const { BOOKS_CLEANED_CSV, BOOKS_CLEANED_NO_DUPLICATES_CSV } = require('../constants')

// FINALLY NOT DOING THIS

const Papa = require('papaparse')
const prompts = require('prompts')
const fs = require('fs')
const groupBy = require('lodash/groupBy')
const papaPromise = require('./utils/papaParser')

const normalizeMIBAuthorsCategories = async (booksPath, destinationPath) => {
  const booksToDelete = {}
  const allBooks = await papaPromise(booksPath)
  const allBooksByAuthor = groupBy(allBooks, 'author')
  const allBooksByAuthorKeys = Object.keys(allBooksByAuthor)
  for (let index = 0; index < allBooksByAuthorKeys.length; index++) {
    const author = allBooksByAuthorKeys[index]
    const bookByAuthor = allBooksByAuthor[author]
    const booksByAuthorTitles = groupBy(bookByAuthor, 'title')
    const booksByAuthorTitlesKeys = Object.keys(booksByAuthorTitles)
    for (let i = 0; i < booksByAuthorTitlesKeys.length; i++) {
      const book = booksByAuthorTitlesKeys[i]
      const booksDuplicated = booksByAuthorTitles[book]
      if (booksDuplicated.length > 1) {
        console.log('Duplicated books author to review:', author)
        booksDuplicated.forEach((book, authorIndex) => {
          console.log(
            `${authorIndex + 1}: ${book.summary} \ncover: ${book.cover_url} \nscore: ${
              book.score
            } \nyear: ${book.publication_year}`
          )
        })
        const { selectedIndex } = await prompts({
          type: 'number',
          name: 'selectedIndex',
          message: 'Which book is the best one',
          initial: 1,
          validate: (number) => number <= booksDuplicated.length,
        })
        const selectedDuplicatedBook = booksDuplicated[selectedIndex - 1].id
        booksDuplicated.forEach((book) => {
          if (book.id !== selectedDuplicatedBook.id) {
            booksToDelete[book.id] = true
          }
        })
      }
    }
  }
  const allBooksNoDuplicates = allBooks.filter((book) => {
    return !booksToDelete[book.id]
  })
  fs.writeFileSync(destinationPath, Papa.unparse(allBooksNoDuplicates))
  console.log(`Categories by most important authors done in ${Object.keys(booksToDelete)} books`)
}

normalizeMIBAuthorsCategories(BOOKS_CLEANED_CSV, BOOKS_CLEANED_NO_DUPLICATES_CSV)
