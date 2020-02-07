#!/usr/bin/env node

const Papa = require('papaparse')
const fs = require('fs')
const matchSorter = require('match-sorter').default
const prompts = require('prompts')
const uniq = require('lodash/uniq')
const papaPromise = require('./papaParser')

// const readMIBDuplidateAuthors = async (booksPath) => {
//   const mostImportantBooks = await papaPromise(booksPath)
//   const mostImportantAuthors = uniq(mostImportantBooks.map((book) => book.author))
//   for (let i = 0; i < mostImportantAuthors.length; i++) {
//     const author = mostImportantAuthors[i]
//     const matchSorterOptions = { keys: ['author'] }
//     const booksAuthorsMatch = matchSorter(mostImportantBooks, author, matchSorterOptions)
//     const uniqAuthors = uniq(booksAuthorsMatch.map((book) => book.author))
//     if (uniqAuthors.length > 1) {
//       console.log('DUPLICATED AUTHOR', author)
//       console.log(uniqAuthors.join(','))
//     }
//   }
// }

// readMIBDuplidateAuthors(MOST_IMPORTANT_BOOKS_INFO_REVIEWED_CSV)

const removeDuplidateAuthors = async (booksPath, destinationPath) => {
  const books = await papaPromise(booksPath)
  const mostImportantAuthors = uniq(books.map((book) => book.author))
  let allBooksUpdate = books
  for (let i = 0; i < mostImportantAuthors.length; i++) {
    const author = mostImportantAuthors[i]
    const matchSorterOptions = { keys: ['author'], threshold: matchSorter.rankings.MATCHES }
    const booksAuthorsMatch = matchSorter(books, author, matchSorterOptions)
    const needsReview = uniq(booksAuthorsMatch.map((book) => book.author)).length > 1
    if (needsReview) {
      console.log('Author to review:', author)
      booksAuthorsMatch.forEach((book, authorIndex) => {
        console.log(`${authorIndex + 1}: ${book.author}`)
      })
      const { manualReview } = await prompts({
        type: 'confirm',
        name: 'manualReview',
        message: 'Does this author need manual review?',
        initial: false,
      })
      if (manualReview) {
        const { selectedIndex } = await prompts({
          type: 'number',
          name: 'selectedIndex',
          message: 'Which author is the best one',
          initial: 1,
          validate: (number) => number <= booksAuthorsMatch.length,
        })
        if (selectedIndex) {
          const selectedBookAuthor = booksAuthorsMatch[selectedIndex - 1].author
          const { authorName } = await prompts({
            type: 'text',
            name: 'authorName',
            value: selectedBookAuthor,
            initial: selectedBookAuthor,
            message: 'Press enter o type the custom name of the author:',
          })
          let choicesSelected = []
          const choices = booksAuthorsMatch
            .filter((book) => book.author !== authorName)
            .map((book) => ({
              title: `${book.author}: ${book.title}`,
              value: book.id,
            }))

          if (choices.length > 15) {
            choices.forEach((choice, authorIndex) => {
              console.log(`${authorIndex + 1}: ${choice.title}`)
            })
            let { indexedToUpdateList } = await prompts({
              type: 'list',
              name: 'indexedToUpdateList',
              message: `Which books do you want to update with the same author name (${authorName})`,
            })
            indexedToUpdateList = indexedToUpdateList
              .filter((i) => i !== '')
              .map((index) => parseInt(index) - 1)
            choicesSelected = choices
              .filter((choice, index) => indexedToUpdateList.includes(index))
              .map((c) => c.value)
          } else {
            const { booksToUpdate } = await prompts({
              type: 'multiselect',
              name: 'booksToUpdate',
              message: `Which books do you want to update with the same author name (${authorName})`,
              choices: booksAuthorsMatch
                .filter((book) => book.author !== authorName)
                .map((book) => ({
                  title: `${book.author}: ${book.title}`,
                  value: book.id,
                })),
            })
            choicesSelected = booksToUpdate
          }
          allBooksUpdate = allBooksUpdate.map((book) => {
            if (choicesSelected.includes(book.id)) {
              return { ...book, author: authorName }
            }
            return book
          })
        }
        fs.writeFileSync(destinationPath, Papa.unparse(allBooksUpdate))
      }
    } else {
      console.log(`Author ${author} review not needed`)
    }
  }
}

module.exports = removeDuplidateAuthors
