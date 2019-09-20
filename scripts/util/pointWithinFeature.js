const turf = require('@turf/turf')
const pointWithinBBox = require('./pointWithinBBox')

module.exports = (point, feature, precomputedBBox) => {
  if (!pointWithinBBox(point, precomputedBBox)) return false
  return turf.booleanPointInPolygon(point.coordinates, feature)
}