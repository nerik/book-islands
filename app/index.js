
// var url = new URL(window.location)

var style = {
  'version': 8,
  'name': 'Blank',
  'metadata': {
    'mapbox:autocomposite': true,
    'mapbox:type': 'template',
    'mapbox:sdk-support': {
      'js': '0.54.0',
      'android': '7.4.0',
      'ios': '4.11.0'
    }
  },
  'center': [-17.641844268726345, 28.149113067706722],
  'zoom': 8.828140409019499,
  'bearing': 0,
  'pitch': 0,
  'sources': {
    'composite': {
      'url': 'mapbox://mapbox.mapbox-streets-v8',
      'type': 'vector'
    },
    'heightmap-generated': {
      // 'url': 'mapbox://mapbox.terrain-rgb',
      'tiles': ['http://localhost:9090/heightmap-test/{z}-{x}-{y}.png'],
      'type': 'raster-dem',
      'tileSize': 256
    },
    'heightmap-mapbox': {
      // 'url': 'mapbox://mapbox.terrain-rgb',
      'tiles': ['http://localhost:9090/heightmap-test/{z}-{x}-{y}_.png'],
      'type': 'raster-dem',
      'tileSize': 256
    },
  },
  'sprite': 'mapbox://sprites/satellitestudio-nerik/ck06nclj82czw1crdlt5l2m9y/ck2u8j60r58fu0sgyxrigm3cu',
  'glyphs': 'mapbox://fonts/satellitestudio-nerik/{fontstack}/{range}.pbf',
  'layers': [
    {
      'id': 'background',
      'type': 'background',
      'paint': {'background-color': 'rgba(0,0,0,0)'}
    },

    {
      'id': 'water',
      'type': 'fill',
      'source': 'composite',
      'source-layer': 'water',
      'layout': {},
      'paint': {'fill-color': 'hsl(214, 58%, 78%)'}
    },
    {
      'id': 'mapbox-terrain-mapbox',
      'type': 'hillshade',
      'source': 'heightmap-mapbox',
      'layout': {},
      'paint': {}
    },
    {
      'id': 'mapbox-terrain-generated',
      'type': 'hillshade',
      'source': 'heightmap-generated',
      'layout': {},
      'paint': {}
    },
   
  ],
  'created': '2019-09-05T12:08:17.941Z',
  'id': 'ck06nclj82czw1crdlt5l2m9y',
  'modified': '2019-09-05T13:35:33.573Z',
  'owner': 'satellitestudio-nerik',
  'visibility': 'private',
  'draft': false
}
var map = new mapboxgl.Map({
  container: 'map',
  style: style,
  hash: true
})
map.showTileBoundaries = true
mapboxgl.accessToken = 'pk.eyJ1Ijoic2F0ZWxsaXRlc3R1ZGlvLW5lcmlrIiwiYSI6ImNrMDNxcnQwaTJocWkzZHE5dTZ3NjJmeGUifQ.eAUQbcE9Qdbq5jYxskIE3A'
