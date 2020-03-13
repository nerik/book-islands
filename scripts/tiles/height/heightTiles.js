#!/usr/bin/env node

const tileReduce = require('@mapbox/tile-reduce')
const path = require('path')
const { MAX_ZOOM_HEIGHTS_GENERATED, ISLAND_TILES } = require('../../constants')

tileReduce({
  zoom: MAX_ZOOM_HEIGHTS_GENERATED,
  map: path.join(__dirname, '/getTileCoordinates.js'),
  // log: true,
  // bbox: [3, 11, 26, 23],
  sources: [
    {
      name: 'islands',
      mbtiles: path.join(ISLAND_TILES, '/islands.mbtiles'),
      // layers: 'islands',
      // raw: true
    },
  ],
})
