#!/usr/bin/env node

const {
  MOST_IMPORTANT_BOOKS_INFO_REVIEWED_FILLED_CSV,
  MOST_IMPORTANT_BOOKS_INFO_REVIEWED_FILLED_NO_DUPLICATES_CSV,
} = require('../constants')
const removeDuplidateAuthors = require('./utils/removeDuplicateAuthors')

removeDuplidateAuthors(
  MOST_IMPORTANT_BOOKS_INFO_REVIEWED_FILLED_CSV,
  MOST_IMPORTANT_BOOKS_INFO_REVIEWED_FILLED_NO_DUPLICATES_CSV
)
