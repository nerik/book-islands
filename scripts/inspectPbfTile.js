#!/usr/bin/env node

const Pbf = require('pbf')
const turf = require('@turf/turf')
const VectorTile = require('@mapbox/vector-tile').VectorTile

const request = require("request");
const fs = require('fs')

const tilePath = process.argv[2]
// console.log(tilePath)

if (tilePath === undefined) {
  console.error('Omitted tile path. Use: ./inspect-vector-tile path/to/tile.pbf')
  process.exit(1)
}

const readTile = (tile) => {
  
  const pbf = new Pbf(tile)
  const vectorTile = new VectorTile(pbf)
  
  const layers = vectorTile.layers
  const layerKeys = Object.keys(layers)

  // console.log('Reading tile:', tilePath)
  // console.log('layers:', layerKeys)
//   const mainLayerName = layerKeys[0]
  const mainLayerName = 'books_labels'
  const tileCoords = [8, 157, 166]
  const mainLayer = layers[mainLayerName]
  const aFeature = mainLayer.feature(0)
  const geojson = aFeature.toGeoJSON(8, 158, 166)

  const features = []
  layerKeys.forEach((layerKey) => {
    const layer = layers[layerKey]
    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i)
      const featureGeoJSON = feature.toGeoJSON(...tileCoords)
      features.push(featureGeoJSON)
    }
  })

  const fc = turf.featureCollection(features)
  console.log(JSON.stringify(fc))


  // console.log('layer name:', mainLayerName)
  // console.log('layer #features', mainLayer.length)
  // console.log('example feature type:', aFeature.type)
  // console.log('example feature:', aFeature.properties)
  // console.log('example feature:bbox:', aFeature.bbox())
  // console.log('example feature to GeoJSON')
  // console.log(geojson)
  // console.log(geojson.properties)
  // console.log(geojson.geometry.coordinates)
}

if (tilePath.substr(0, 4) === 'http') {
  var requestSettings = {
    method: 'GET',
    url: tilePath,
    encoding: null,
};
  request(requestSettings, (error, response, body) => {
    // let json = JSON.parse(body);
    console.log(body);
    readTile(body)
  });
  return
} else {
  readTile(fs.readFileSync(tilePath))
}
