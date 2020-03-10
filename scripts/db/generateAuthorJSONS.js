#!/usr/bin/env node

const workerpool = require('workerpool')
const fs = require('fs')
const Database = require('sqlite-async')
const getAuthorInfo = require('./utils/fetchAuthorInfo')

const kebabCase = require('lodash/kebabCase')
const {
  BOOKS_DB,
  BOOKS_DB_TABLE,
  AUTHORS_JSON,
  AUTHORS_ERROR_JSON,
  ISLAND_RANK_SCALE,
} = require('../constants')

const MAX_RANK_TO_GENERATE = 3
const MAX_WORKERS = 3
const INDEX_START = 0
const USE_WORKER = true

var pool = workerpool.pool(__dirname + '/workers/getAuthorInfo.js', {
  maxWorkers: MAX_WORKERS,
})

const generateAuthorJsons = async (authors) => {
  const authorsWithErrors = []
  for (let i = INDEX_START; i < authors.length; i++) {
    const { author, bookId } = authors[i]
    if (USE_WORKER) {
      pool
        .proxy()
        .then((worker) => {
          return worker.getAuthorInfo(author, bookId)
        })
        .then((authorInfo) => {
          console.log(`${i} ${author} ✅`)
          fs.writeFileSync(`${AUTHORS_JSON}/${kebabCase(author)}.json`, JSON.stringify(authorInfo))
        })
        .catch((err) => {
          console.log(`${i} ${author} ❌`)
          authorsWithErrors.push(err.message)
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
        const authorInfo = await getAuthorInfo(author, bookId)
        fs.writeFileSync(`${AUTHORS_JSON}/${kebabCase(author)}.json`, JSON.stringify(authorInfo))
        console.log(`${i} ${author} ✅`)
      } catch {
        console.log(`${i} ${author} ❌`)
        authorsWithErrors.push(author)
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
  const dbQuery = `SELECT author, sum(score) AS score, public_id as bookId FROM (SELECT * FROM ${BOOKS_DB_TABLE} ORDER BY score DESC) GROUP BY author ORDER BY score DESC`
  const rows = await db.all(dbQuery)
  const authors = rows.map(({ author, bookId, score }) => {
    return { author, bookId, rank: ISLAND_RANK_SCALE(score) }
  })

  const authorsToFetch = authors.filter(({ rank }) => rank < MAX_RANK_TO_GENERATE)
  generateAuthorJsons(authorsToFetch)
}

const generateAuthorErrorJsons = async () => {
  const authors = JSON.parse(fs.readFileSync(AUTHORS_ERROR_JSON, 'utf-8'))
  generateAuthorJsons(authors)
}

const getSingleAuthor = async (author, bookId) => {
  try {
    const authorInfo = await getAuthorInfo(author, bookId)
    console.log('Author info', authorInfo)
  } catch (e) {
    console.error(e)
  }
}

generateAuthorDBJsons()
// generateAuthorErrorJsons()
// getSingleAuthor('James Waller', 'yn7kAAAAIAAJ')
// getSingleAuthor('Tim Bergling', 'lSwbAAAAYAAJ')
// getSingleAuthor('Chuck Yeager', 'pqdHKsDa4nMC')
// getSingleAuthor('Carl Boggs', 'wNw_uw4BBlsC')
// getSingleAuthor('Linda Camp Keith')
// getSingleAuthor('Juan Carlos Alonso Lena')
