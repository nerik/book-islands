const workerpool = require('workerpool')
const tryGetTerritories = require('./tryGetTerritories')

workerpool.worker({
  tryGetTerritories
})
