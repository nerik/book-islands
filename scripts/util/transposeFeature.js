const turf = require('@turf/turf')

const transposeFeature = (feature, offset, scale = 1) => {
  
  const mercatorFeature = turf.toMercator(feature)
  const mercatorOffset = turf.toMercator(offset)
  const minX = mercatorOffset.geometry.coordinates[0]
  const minY = mercatorOffset.geometry.coordinates[1]

  const coords = mercatorFeature.geometry.coordinates[0]
  const translatedCoords = coords.map(c => {
    return [scale * c[0] - minX, scale * c[1] - minY]
  })
  const newFeature = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        translatedCoords
      ] 
    },
    properties: {
      ...feature.properties,
    }
  }

  return turf.toWgs84(newFeature)
}
module.exports = transposeFeature
