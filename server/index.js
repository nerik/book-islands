var path = require('path')
var express = require('express')
var app = express()
var cors = require('cors')

const PORT = 9090

console.log(`on port ${PORT}`)

app.use(cors())
app.use(express.static(path.join(__dirname, '../tiles'), {
  // TODO Put back for PBF tiles
  setHeaders: (res) => {
    // console.log(res)
    res.set('Content-Encoding', 'gzip')
  },
  // fallthrough: false
}))

app.listen(PORT)
