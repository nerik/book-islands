const tileReduce = require('@mapbox/tile-reduce')
const path = require('path')
const {
  MAX_ZOOM_GENERATED,
  ISLANDS_TILES
} = require('../../constants')

tileReduce({
  zoom: MAX_ZOOM_GENERATED,
  map: path.join(__dirname, '/getTileCoordinates.js'),
  sources: [
    {
      name: 'islands',
      mbtiles: path.join(ISLANDS_TILES, '/main.mbtiles'),
      // raw: true
    }
  ]
})
