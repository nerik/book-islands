#!/usr/bin/env node

const fs = require('fs')
const matchSorter = require('match-sorter').default
const requestPromise = require('request-promise')
const prompts = require('prompts')
const Papa = require('papaparse')
const {
  BOOKS_CSV,
  BOOKS_DB_TABLE,
  BOOKS_DB_290K,
  BOOKS_WITHOUT_DUPLICATES_CSV,
  MOST_IMPORTANT_BOOKS_CSV,
  MOST_IMPORTANT_BOOKS_INFO_CSV,
} = require('../constants')
const uniqBy = require('lodash/uniqBy')
const Database = require('sqlite-async')

const booksFile = fs.createReadStream(BOOKS_CSV)
const mostImportantBooksFile = fs.createReadStream(MOST_IMPORTANT_BOOKS_CSV)

const START_INDEX = 0
let currentIndex = 0
const allBooks = []

const papaPromise = (importFile) =>
  new Promise((resolve, reject) => {
    const file = fs.createReadStream(importFile)
    Papa.parse(file, {
      header: true,
      complete: function({ data }) {
        resolve(data)
      },
      error: function(error) {
        reject(error)
      },
    })
  })

const extractMostImportantbooksInfo = async () => {
  let allBooksWithoutDuplicates = []
  let matchedImportantBooks = []
  let db
  try {
    db = await Database.open(BOOKS_DB_290K, Database.OPEN_READONLY)
  } catch (e) {
    console.log('Error opening database', e)
  }
  // try {
  //   allBooksWithoutDuplicates = await papaPromise(BOOKS_WITHOUT_DUPLICATES_CSV)
  // } catch (e) {
  //   console.log('Error reading no duplicates books', e.message)
  // }
  // try {
  //   matchedImportantBooks = await papaPromise(MOST_IMPORTANT_BOOKS_INFO_CSV)
  // } catch (e) {
  //   console.log('Error reading important books books', e.message)
  // }
  Papa.parse(booksFile, {
    header: true,
    step: function({ data }) {
      allBooks.push(data)
    },
    complete: function() {
      Papa.parse(mostImportantBooksFile, {
        header: true,
        step: async function({ data }, parser) {
          currentIndex++
          if (currentIndex < START_INDEX) {
            return
          }
          parser.pause()
          const bookTitleMatch = matchSorter(allBooks, data.title, { keys: ['title'] })
          const authorAndTitleMatch = matchSorter(bookTitleMatch, data.author, { keys: ['author'] })
          if (!authorAndTitleMatch.length && db) {
            // Search in the entire books database event if it doesn't have a good categorization
            console.log(
              'Fetching information from entire database (without categories normalization)',
              data.title
            )
            const query = `SELECT *, id || '' as id FROM ${BOOKS_DB_TABLE} WHERE title LIKE '%${data.title}%' ORDER BY score DESC`
            const books290kResults = await db.all(query)
            let bookInfo = {
              id: 'not-found',
            }
            if (books290kResults) {
              const book290kTitleMatch = matchSorter(books290kResults, data.title, {
                keys: ['title'],
              })
              const books290kAuthorAndTitleMatch = matchSorter(book290kTitleMatch, data.author, {
                keys: ['author'],
              })
              if (books290kAuthorAndTitleMatch.length) {
                if (books290kAuthorAndTitleMatch.length === 1) {
                  bookInfo = books290kAuthorAndTitleMatch[0]
                } else {
                  console.log(`Book to match: ${data.title} - ${data.author}`)
                  let initialIndex = 1
                  books290kAuthorAndTitleMatch.forEach((book, index) => {
                    if (book.description !== '[NULL]') {
                      initialIndex = index + 1
                    }
                    console.log(
                      `${index + 1}: ${book.title} - ${book.author} \n description: ${
                        book.description
                      } \n`
                    )
                  })
                  const { index } = await prompts({
                    type: 'number',
                    name: 'index',
                    message: 'Which book is the right one',
                    initial: initialIndex,
                    validate: (number) => number <= matchedImportantBooks.length,
                  })
                  bookInfo = {
                    ...books290kAuthorAndTitleMatch[index - 1],
                    category: 'TO_NORMALIZE',
                  }
                }
              }
            }
            if (bookInfo.id === 'not-found') {
              console.log('Fetching information from knowledge graph', data.title)
              const uri = `https://kgsearch.googleapis.com/v1/entities:search?query=${data.title}&key=AIzaSyC0bsRnDv-jx6ca4lMwmL2bLyIribLAtds&limit=1&indent=True&types=Book`
              try {
                const { itemListElement } = await requestPromise({ uri, json: true })
                if (itemListElement[0] && itemListElement[0].result) {
                  const { description, detailedDescription, image } = itemListElement[0].result
                  const summary =
                    (detailedDescription && detailedDescription.articleBody) || description || ''
                  const summaryCleaned = summary.replace('/\n/g', '').trim()
                  bookInfo = {
                    id: `autogenerated-${currentIndex}`,
                    score: 100000,
                    publication_year: '',
                    publication_year_extra: '',
                    category: '',
                    title: data.title,
                    cover_url: (image && image.contentUrl) || '',
                    author: data.author,
                    summary: summaryCleaned,
                    description: summaryCleaned,
                  }
                  // console.log('Information found', bookInfo)
                } else {
                  console.log(`No information found for ${data.title} including empty book info`)
                }
              } catch (e) {
                console.log('Error fetching book info', e)
              }
            }
            matchedImportantBooks.push(bookInfo)
          } else if (authorAndTitleMatch.length === 1) {
            matchedImportantBooks.push(authorAndTitleMatch[0])
          } else if (authorAndTitleMatch.length > 1) {
            console.log(`Book to match: ${data.title} - ${data.author}`)
            let initialIndex = 1
            authorAndTitleMatch.forEach((book, index) => {
              if (book.description !== '[NULL]') {
                initialIndex = index + 1
              }
              console.log(
                `${index + 1}: ${book.title} - ${book.author} \n description: ${
                  book.description
                } \n`
              )
            })
            const { index } = await prompts({
              type: 'number',
              name: 'index',
              message: 'Which book is the right one',
              initial: initialIndex,
              validate: (number) => number <= matchedImportantBooks.length,
            })
            const selectedBook = authorAndTitleMatch[index - 1]
            matchedImportantBooks.push(selectedBook)
            const { remove } = await prompts({
              type: 'confirm',
              name: 'remove',
              message: 'Do you want to remove the rest of the books found?',
              initial: true,
            })
            if (remove) {
              const bookIdsToRemove = authorAndTitleMatch
                .filter((book) => book.id !== selectedBook.id)
                .map((book) => book.id)
              const booksToFilter = allBooksWithoutDuplicates.length
                ? allBooksWithoutDuplicates
                : allBooks
              allBooksWithoutDuplicates = booksToFilter.filter(
                (book) => !bookIdsToRemove.includes(book.id)
              )
            }
          }
          fs.writeFileSync(MOST_IMPORTANT_BOOKS_INFO_CSV, Papa.unparse(matchedImportantBooks))
          fs.writeFileSync(BOOKS_WITHOUT_DUPLICATES_CSV, Papa.unparse(allBooksWithoutDuplicates))
          parser.resume()
        },
        complete: function() {
          const uniqMatchedImportantBooksData = uniqBy(matchedImportantBooks, 'id')
          console.log('Total:', uniqMatchedImportantBooksData.length)
          const matchedImportantBooksCsv = Papa.unparse(uniqMatchedImportantBooksData)
          fs.writeFileSync(MOST_IMPORTANT_BOOKS_INFO_CSV, matchedImportantBooksCsv)
          const allBooksWithoutDuplicatesCsv = Papa.unparse(uniqBy(allBooksWithoutDuplicates, 'id'))
          fs.writeFileSync(BOOKS_WITHOUT_DUPLICATES_CSV, allBooksWithoutDuplicatesCsv)
          console.log('Read all files finished')
        },
      })
    },
  })
}

extractMostImportantbooksInfo()
