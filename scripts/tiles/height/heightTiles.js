#!/usr/bin/env node

const tileReduce = require('@mapbox/tile-reduce')
const path = require('path')
const { MAX_ZOOM_HEIGHTS_GENERATED, ALL_VECTOR_TILES } = require('../../constants')

tileReduce({
  zoom: MAX_ZOOM_HEIGHTS_GENERATED,
  map: path.join(__dirname, '/getTileCoordinates.js'),
  sources: [
    {
      name: 'islands',
      mbtiles: path.join(ISLANDS_TILES, '/islands.mbtiles'),
      // raw: true
    },
  ],
})
