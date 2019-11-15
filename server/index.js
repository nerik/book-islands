var path = require('path')
var express = require('express')
var app = express()
var cors = require('cors')

const PORT = 9090

console.log(`on port ${PORT}`)

app.use(cors())
app.use(function(req, res, next) {
  var ext = path.extname(req.url)
  if (ext !== '.png') {
    res.setHeader('Content-Encoding', 'gzip')
  }
  next()
})
app.use(express.static(path.join(__dirname, '../tiles')))

app.listen(PORT)
