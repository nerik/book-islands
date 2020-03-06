#!/usr/bin/env node

const workerpool = require('workerpool')
const fs = require('fs')
const Database = require('sqlite-async')
const getAuthorInfo = require('./utils/fetchAuthorInfo')

const kebabCase = require('lodash/kebabCase')
const { BOOKS_DB, BOOKS_DB_TABLE, AUTHORS_JSON, AUTHORS_ERROR_JSON } = require('../constants')

const MAX_WORKERS = 3
const INDEX_START = 0
const USE_WORKER = true

var pool = workerpool.pool(__dirname + '/workers/getAuthorInfo.js', {
  maxWorkers: MAX_WORKERS,
})

const generateAuthorJsons = async (authors) => {
  const authorsWithErrors = []
  for (let i = INDEX_START; i < authors.length; i++) {
    const author = authors[i]
    if (USE_WORKER) {
      pool
        .proxy()
        .then((worker) => {
          return worker.getAuthorInfo(author)
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
        const authorInfo = await getAuthorInfo(author)
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
  const dbQuery = `SELECT author FROM ${BOOKS_DB_TABLE} GROUP BY author ORDER BY score DESC`
  const rows = await db.all(dbQuery)
  const authors = rows.map((row) => row.author)
  generateAuthorJsons(authors)
}

const generateAuthorErrorJsons = async () => {
  const authors = JSON.parse(fs.readFileSync(AUTHORS_ERROR_JSON, 'utf-8'))
  generateAuthorJsons(authors)
}

const getSingleAuthor = async (author) => {
  try {
    const authorInfo = await getAuthorInfo(author)
    console.log('Author info', authorInfo)
  } catch (e) {
    console.error(e)
  }
}

// generateAuthorDBJsons()
generateAuthorErrorJsons()
// getSingleAuthor('paquito palotes')
// getSingleAuthor('Linda Camp Keith')
// getSingleAuthor('Juan Carlos Alonso Lena')
