#!/usr/bin/env node

const { BOOKS_MI_MERGED_CSV, BOOKS_MI_MERGED_NO_DUPLICATES_CSV } = require('../constants')
const removeDuplidateAuthors = require('./utils/removeDuplicateAuthors')

// TODO: remove only from MIB books matches
removeDuplidateAuthors(BOOKS_MI_MERGED_CSV, BOOKS_MI_MERGED_NO_DUPLICATES_CSV)
