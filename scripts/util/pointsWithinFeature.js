const turf = require('@turf/turf')
const pointWithinBBox = require('./pointWithinBBox')

module.exports = (points, feature) => {
  for (let i = 0; i < points.length; i++) {
    if (!turf.booleanPointInPolygon(points[i], feature)) return false
  }
  return true
}
