/* global mapboxgl, d3 */

const style = {
  version: 8,
  center: [23.74364452799591, 63.82700345816383],
  zoom: 5.995118785747092,
  bearing: 0,
  pitch: 0,
  sources: {
    composite: {
      url: 'mapbox://satellitestudio-nerik.91lr70mc',
      type: 'vector',
    },
    // 'heightmap-generated': {
    //   // 'url': 'mapbox://mapbox.terrain-rgb',
    //   'tiles': ['https://storage.googleapis.com/books-detail-data/height3/{z}/{x}/{y}.png'],
    //   'type': 'raster-dem',
    //   'tileSize': 256
    // },
    islands: {
      type: 'vector',
      // tiles: ['https://storage.googleapis.com/books-detail-data/islands/{z}/{x}/{y}.pbf'],
      tiles: ['http://localhost:9090/islands/tiles/{z}/{x}/{y}.pbf'],
      maxzoom: 12,
    },
    territories: {
      type: 'vector',
      tiles: ['http://localhost:9090/territories/tiles/{z}/{x}/{y}.pbf'],
      maxzoom: 10,
    },
    points: {
      type: 'vector',
      // tiles: ['https://storage.googleapis.com/books-detail-data/points/tiles/{z}/{x}/{y}.pbf'],
      tiles: ['http://localhost:9090/points/tiles/{z}/{x}/{y}.pbf'],
      minzoom: 3,
      maxzoom: 13,
    },
  },
  sprite:
    'mapbox://sprites/satellitestudio-nerik/ck0po9xqr15641doeyt8t0ctg/ck2u8j60r58fu0sgyxrigm3cu',
  glyphs: 'mapbox://fonts/satellitestudio-nerik/{fontstack}/{range}.pbf',
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': 'rgba(0,0,0,0)' },
    },
    {
      id: 'islands',
      type: 'fill',
      source: 'islands',
      'source-layer': 'islands',
      layout: {},
      paint: { 'fill-color': 'hsl(252, 93%, 49%)', 'fill-opacity': 0.17 },
    },
    {
      id: 'territories',
      type: 'line',
      source: 'territories',
      'source-layer': 'territories',
      minzoom: 6,
      layout: {},
      paint: {},
    },
    {
      id: 'books_labels_pts',
      type: 'circle',
      source: 'points',
      'source-layer': 'books_labels',
      paint: {
        'circle-color': 'hsl(0, 85%, 49%)',
        'circle-radius': 3,
      },
    },
    {
      id: 'books_labels',
      type: 'symbol',
      source: 'points',
      'source-layer': 'books_labels',
      layout: {
        'text-field': ['to-string', ['get', 'title']],
        'text-size': 12,
        'text-allow-overlap': true,
      },
      paint: { 'text-color': 'hsl(0, 85%, 49%)' },
    },
    // {
    //   'id': 'books_labels_pts',
    //   type: 'circle',
    //   'source': 'points',
    //   'source-layer': 'books_labels',
    //   minzoom: 10,
    //   paint: {
    //     'circle-color': 'hsl(0, 85%, 49%)',
    //     'circle-radius': 3,
    //   }
    // },

    // {
    //   'id': 'books_labels_4',
    //   'type': 'symbol',
    //   'source': 'points',
    //   'source-layer': 'books_labels',
    //   minzoom: 12,
    //   'filter': ['match', ['get', 'rank'], [4], true, false],
    //   'layout': {
    //     'text-field': ['to-string', ['get', 'title']],
    //     'text-size': 12
    //   },
    //   'paint': {'text-color': 'hsl(0, 85%, 49%)'}
    // },
    // {
    //   'id': 'books_labels_3',
    //   'type': 'symbol',
    //   'source': 'points',
    //   'source-layer': 'books_labels',
    //   minzoom: 11,
    //   'filter': ['match', ['get', 'rank'], [3], true, false],
    //   'layout': {
    //     'text-field': ['to-string', ['get', 'title']],
    //     'text-size': 14
    //   },
    //   'paint': {'text-color': 'hsl(0, 85%, 49%)'}
    // },
    // {
    //   'id': 'books_labels_2',
    //   'type': 'symbol',
    //   'source': 'points',
    //   'source-layer': 'books_labels',
    //   minzoom: 10,
    //   'filter': ['match', ['get', 'rank'], [2], true, false],
    //   'layout': {
    //     'text-field': ['to-string', ['get', 'title']],
    //     'text-size': 16
    //   },
    //   'paint': {'text-color': 'hsl(0, 85%, 49%)'}
    // },
    // {
    //   'id': 'books_labels_1',
    //   'type': 'symbol',
    //   'source': 'points',
    //   'source-layer': 'books_labels',
    //   'filter': ['match', ['get', 'rank'], [1], true, false],
    //   minzoom: 10,
    //   'layout': {
    //     'text-field': ['to-string', ['get', 'title']],
    //     'text-size': 22
    //   },
    //   'paint': {'text-color': 'hsl(0, 85%, 49%)'}
    // },
    // {
    //   'id': 'author_labels_4',
    //   'type': 'symbol',
    //   'source': 'points',
    //   'source-layer': 'author_labels',
    //   minzoom: 10,
    //   'filter': ['match', ['get', 'rank'], [4], true, false],
    //   'layout': {
    //     'text-field': ['to-string', ['get', 'id']],
    //     'text-size': 14,
    //     'text-transform': 'uppercase'
    //   },
    //   'paint': {
    //     'text-color': 'hsl(0, 0%, 0%)'
    //   }
    // },
    // {
    //   'id': 'author_labels_3',
    //   'type': 'symbol',
    //   'source': 'points',
    //   'source-layer': 'author_labels',
    //   minzoom: 9,
    //   'filter': ['match', ['get', 'rank'], [3], true, false],
    //   'layout': {
    //     'text-field': ['to-string', ['get', 'id']],
    //     'text-size': 18,
    //     'text-transform': 'uppercase'
    //   },
    //   'paint': {
    //     'text-color': 'hsl(0, 0%, 0%)'
    //   }
    // },
    // {
    //   'id': 'author_labels_2',
    //   'type': 'symbol',
    //   'source': 'points',
    //   'source-layer': 'author_labels',
    //   minzoom: 8,
    //   'filter': ['match', ['get', 'rank'], [2], true, false],
    //   'layout': {
    //     'text-field': ['to-string', ['get', 'id']],
    //     'text-size': 25,
    //     'text-transform': 'uppercase'
    //   },
    //   'paint': {
    //     'text-color': 'hsl(0, 0%, 0%)'
    //   }
    // },
    // {
    //   'id': 'author_labels_1',
    //   'type': 'symbol',
    //   'source': 'points',
    //   'source-layer': 'author_labels',
    //   minzoom: 8,
    //   'filter': ['match', ['get', 'rank'], [1], true, false],
    //   'layout': {
    //     'text-field': ['to-string', ['get', 'id']],
    //     'text-size': 40,
    //     'text-transform': 'uppercase'
    //   },
    //   'paint': {
    //     'text-color': 'hsl(0, 0%, 0%)'
    //   }
    // },

    // {
    //   'id': 'territory-labels_pts',
    //   type: 'circle',
    //   'source': 'points',
    //   'source-layer': 'territory_labels',
    // },
    // {
    //   'id': 'territory-labels_4',
    //   'type': 'symbol',
    //   'source': 'points',
    //   'source-layer': 'territory_labels',
    //   'filter': ['match', ['get', 'rank'], [4], true, false],
    //   minzoom: 8,
    //   'layout': {
    //     'text-field': ['to-string', ['get', 'label']],
    //     'text-size': [
    //       'interpolate',
    //       ['linear'],
    //       ['zoom'],
    //       6,
    //       10,
    //       10,
    //       16
    //     ]
    //   },
    //   'paint': {'text-color': 'hsl(156, 85%, 49%)'}
    // },
    // {
    //   'id': 'territory-labels_3',
    //   'type': 'symbol',
    //   'source': 'points',
    //   'source-layer': 'territory_labels',
    //   'filter': ['match', ['get', 'rank'], [3], true, false],
    //   minzoom: 7,
    //   'layout': {
    //     'text-field': ['to-string', ['get', 'label']],
    //     'text-size': [
    //       'interpolate',
    //       ['linear'],
    //       ['zoom'],
    //       6,
    //       10,
    //       10,
    //       16
    //     ]
    //   },
    //   'paint': {'text-color': 'hsl(100, 85%, 49%)'}
    // },
    // {
    //   'id': 'territory-labels_2',
    //   'type': 'symbol',
    //   'source': 'points',
    //   'source-layer': 'territory_labels',
    //   'filter': ['match', ['get', 'rank'], [2], true, false],
    //   minzoom: 6,
    //   'layout': {
    //     'text-field': ['to-string', ['get', 'label']],
    //     'text-size': [
    //       'interpolate',
    //       ['linear'],
    //       ['zoom'],
    //       6,
    //       10,
    //       10,
    //       16
    //     ]
    //   },
    //   'paint': {'text-color': 'hsl(1, 85%, 49%)'}
    // },
    // {
    //   'id': 'territory-labels_1',
    //   'type': 'symbol',
    //   'source': 'points',
    //   'source-layer': 'territory_labels',
    //   'filter': ['match', ['get', 'rank'], [1], true, false],
    //   minzoom: 4,
    //   'layout': {
    //     'text-field': ['to-string', ['get', 'label']],
    //     'text-size': [
    //       'interpolate',
    //       ['linear'],
    //       ['zoom'],
    //       4,
    //       10,
    //       6,
    //       12,
    //       10,
    //       20
    //     ]
    //   },
    //   'paint': {}
    // },
  ],
}

mapboxgl.accessToken =
  'pk.eyJ1Ijoic2F0ZWxsaXRlc3R1ZGlvLW5lcmlrIiwiYSI6ImNrMDNxcnQwaTJocWkzZHE5dTZ3NjJmeGUifQ.eAUQbcE9Qdbq5jYxskIE3A'
const map = new mapboxgl.Map({
  container: 'map',
  style,
  center: [0, 0],
  zoom: 3,
  hash: true,
})
map.showTileBoundaries = true

map.on('click', 'books_labels', function(e) {
  console.log(e.features[0])
})
