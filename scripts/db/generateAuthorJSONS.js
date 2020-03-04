#!/usr/bin/env node

const workerpool = require('workerpool')
const fs = require('fs')
const Database = require('sqlite-async')

const kebabCase = require('lodash/kebabCase')
const { BOOKS_DB, BOOKS_DB_TABLE, AUTHORS_JSON } = require('../constants')

const MAX_WORKERS = 20
const INDEX_START = 0

var pool = workerpool.pool(__dirname + '/workers/getAuthorInfo.js', {
  maxWorkers: MAX_WORKERS,
})

const generateAuthorJsons = async () => {
  if (!fs.existsSync(AUTHORS_JSON)) {
    fs.mkdirSync(AUTHORS_JSON)
  }
  const authorsWithErrors = []
  const db = await Database.open(BOOKS_DB, Database.OPEN_READONLY)
  const dbQuery = `SELECT author FROM ${BOOKS_DB_TABLE} GROUP BY author ORDER BY score DESC`
  const rows = await db.all(dbQuery)

  for (let i = INDEX_START; i < rows.length; i++) {
    const { author } = rows[i]
    pool
      .proxy()
      .then((worker) => {
        return worker.getAuthorInfo(author)
      })
      .then((authorInfo) => {
        fs.writeFileSync(`${AUTHORS_JSON}/${kebabCase(author)}.json`, JSON.stringify(authorInfo))
      })
      .catch((err) => {
        authorsWithErrors.push(err.message)
      })
      .then(() => {
        const { pendingTasks, activeTasks } = pool.stats()
        if (pendingTasks === 0 && activeTasks === 0) {
          fs.writeFileSync(`out/author-errors.json`, JSON.stringify(authorsWithErrors))
          console.log('Finished! see author with erros in out/author-errors.json')
          pool.terminate()
        } else if ((pendingTasks + activeTasks) % MAX_WORKERS === 0) {
          console.log('Pending tasks', pendingTasks + activeTasks)
        }
      })
  }
}

generateAuthorJsons()
