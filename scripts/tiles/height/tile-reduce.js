const tileReduce = require('@mapbox/tile-reduce')
const path = require('path')
const {
  ISLANDS_TILES
} = require('../../constants')

tileReduce({
  zoom: 13,
  map: path.join(__dirname, '/getTileCoordinates.js'),
  sources: [
    {
      name: 'islands',
      mbtiles: path.join(ISLANDS_TILES, '/main.mbtiles'),
      // raw: true
    }
  ]
})
