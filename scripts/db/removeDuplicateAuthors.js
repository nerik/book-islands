#!/usr/bin/env node

const {
  BOOKS_MI_MERGED_CSV,
  MOST_IMPORTANT_BOOKS_INFO_REVIEWED_FILLED_NO_DUPLICATES_CSV,
  BOOKS_MI_MERGED_NO_DUPLICATES_CSV,
} = require('../constants')
const removeDuplidateAuthors = require('./utils/removeDuplicateAuthors')

removeDuplidateAuthors(
  BOOKS_MI_MERGED_CSV,
  MOST_IMPORTANT_BOOKS_INFO_REVIEWED_FILLED_NO_DUPLICATES_CSV,
  BOOKS_MI_MERGED_NO_DUPLICATES_CSV
)
