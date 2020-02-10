const Papa = require('papaparse')
const fs = require('fs')

const papaPromise = (importFilePath, options = {}) =>
  new Promise((resolve, reject) => {
    const file = fs.createReadStream(importFilePath)
    Papa.parse(file, {
      header: true,
      complete: function({ data }) {
        resolve(data)
      },
      error: function(error) {
        reject(error)
      },
      ...options,
    })
  })

module.exports = papaPromise
