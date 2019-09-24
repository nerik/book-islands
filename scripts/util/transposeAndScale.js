const {scale, translate, compose, applyToPoints} = require('transformation-matrix')

module.exports = (center, polygon, newScale = 1) => {
  // latest transformations apply first
  const matrix = compose(
    // translate to target center
    translate(center.geometry.coordinates[0], center.geometry.coordinates[1]),
    // apply transformation(s)
    scale(newScale, newScale),
  )
  
  const newPolygon = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: []
    }
  }
  // TODO that [0] wont work with multipolygons
  newPolygon.geometry.coordinates[0] = applyToPoints(matrix, polygon.geometry.coordinates[0]) 
  return newPolygon
}