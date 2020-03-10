const workerpool = require('workerpool')
const getAuthorInfo = require('../utils/fetchAuthorInfo')

workerpool.worker({
  getAuthorInfo: getAuthorInfo,
})
