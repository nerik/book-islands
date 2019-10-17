var workerpool = require('workerpool')
const { renderTile } = require('./renderTile')

workerpool.worker({
  renderTile: renderTile
})

