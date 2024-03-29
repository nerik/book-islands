#!/usr/bin/env node

const workerpool = require('workerpool')
const fs = require('fs')
const Database = require('sqlite-async')
const getAuthorInfo = require('./utils/fetchAuthorInfo')

const kebabCase = require('lodash/kebabCase')
const {
  BOOKS_DB,
  MI_AUTHORS,
  BOOKS_DB_TABLE,
  AUTHORS_JSON,
  AUTHORS_ERROR_JSON,
  ISLAND_RANK_SCALE,
} = require('../constants')

const MAX_WORKERS = 3
const INDEX_START = 0
const USE_WORKER = true

var pool = workerpool.pool(__dirname + '/workers/getAuthorInfo.js', {
  maxWorkers: MAX_WORKERS,
})

const generateAuthorJsons = async (authors) => {
  const authorsWithErrors = []

  const handleAuthorMissing = (author, index) => {
    console.log(`${index} ${author} ❌`)
    authorsWithErrors.push(author)
    const id = kebabCase(author)
    fs.writeFileSync(`${AUTHORS_JSON}/${id}.json`, JSON.stringify({ id, name: author }))
  }
  for (let i = INDEX_START; i < authors.length; i++) {
    const { author, book } = authors[i]
    if (USE_WORKER) {
      pool
        .proxy()
        .then((worker) => {
          return worker.getAuthorInfo(author, book)
        })
        .then((authorInfo) => {
          if (authorInfo) {
            console.log(`${i} ${author} ✅`)
            fs.writeFileSync(
              `${AUTHORS_JSON}/${kebabCase(author)}.json`,
              JSON.stringify(authorInfo)
            )
          } else {
            handleAuthorMissing(author, i)
          }
        })
        .catch((err) => {
          handleAuthorMissing(author, i)
        })
        .then(() => {
          const { pendingTasks, activeTasks } = pool.stats()
          if (pendingTasks === 0 && activeTasks === 0) {
            fs.writeFileSync(AUTHORS_ERROR_JSON, JSON.stringify(authorsWithErrors))
            console.log('Finished! see author with erros in out/author-errors.json')
            pool.terminate()
          } else if ((pendingTasks + activeTasks) % MAX_WORKERS === 0) {
            console.log('Pending tasks', pendingTasks + activeTasks)
          }
        })
    } else {
      try {
        const authorInfo = await getAuthorInfo(author, book)
        if (authorInfo) {
          fs.writeFileSync(`${AUTHORS_JSON}/${kebabCase(author)}.json`, JSON.stringify(authorInfo))
          console.log(`${i} ${author} ✅`)
        } else {
          handleAuthorMissing(author, i)
        }
      } catch {
        handleAuthorMissing(author, i)
      }
    }
  }
  if (!USE_WORKER) {
    fs.writeFileSync(AUTHORS_ERROR_JSON, JSON.stringify(authorsWithErrors))
    console.log('Finished! see author with erros in out/author-errors.json')
  }
}

const generateAuthorDBJsons = async () => {
  if (!fs.existsSync(AUTHORS_JSON)) {
    fs.mkdirSync(AUTHORS_JSON)
  }
  const db = await Database.open(BOOKS_DB, Database.OPEN_READONLY)
  const dbQuery = `SELECT author, sum(score) AS score, public_id as bookId, title FROM (SELECT * FROM ${BOOKS_DB_TABLE} ORDER BY score DESC) GROUP BY author ORDER BY score DESC`
  const rows = await db.all(dbQuery)
  const authors = rows.map(({ author, bookId, score, title }) => {
    return { author, rank: ISLAND_RANK_SCALE(score), book: { id: bookId, title } }
  })

  // const authorsToFetch = authors.filter(({ rank }) => rank < MAX_RANK_TO_GENERATE)
  generateAuthorJsons(authors)
}

const generateAuthorErrorJsons = async () => {
  const authors = JSON.parse(fs.readFileSync(AUTHORS_ERROR_JSON, 'utf-8'))
  const mostImportantAuthors = JSON.parse(fs.readFileSync(MI_AUTHORS, 'utf-8'))
  const mostImportantPendingAuthors = authors.filter((author) =>
    mostImportantAuthors.includes(author)
  )
  generateAuthorJsons(mostImportantPendingAuthors.map((author) => ({ author })))
}

const getSingleAuthor = async (author, book) => {
  try {
    const authorInfo = await getAuthorInfo(author, book)
    console.log('Author info', authorInfo)
    fs.writeFileSync(`${AUTHORS_JSON}/${kebabCase(author)}.json`, JSON.stringify(authorInfo))
  } catch (e) {
    console.error(e)
  }
}

generateAuthorDBJsons()
// generateAuthorErrorJsons()
// generateAuthorJsons([
//   // { author: 'zaharia stancu', book: { id: 'g0UAh2v-W2sC' } },
//   // { author: 'Thomas Wolfe', book: { id: 'ZCyaAAAAIAAJ' } },
//   // { author: 'Sophocles', book: { id: 'lVOxAAAAIAAJ' } },
//   { author: 'Pepe paco' },
// ])
// getSingleAuthor('James Waller', 'yn7kAAAAIAAJ')
// getSingleAuthor('Tim Bergling', 'lSwbAAAAYAAJ')
// getSingleAuthor('Chuck Yeager', 'pqdHKsDa4nMC')
// getSingleAuthor('Carl Boggs', 'wNw_uw4BBlsC')
// getSingleAuthor('Linda Camp Keith')
// getSingleAuthor('Juan Carlos Alonso Lena')
// getSingleAuthor('thomas wolfe')
// getSingleAuthor('Leo Lionni')
// getSingleAuthor('Mungo Park')
