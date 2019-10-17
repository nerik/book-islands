const turf = require('@turf/turf')
const _ = require('lodash')
const {translate, compose, applyToPoints} = require('transformation-matrix')

module.exports = (featureMrct, parentFeatureForCenter = null) => {
  const f = _.cloneDeep(featureMrct)
  const originalCenter = (parentFeatureForCenter === null)
    ? turf.coordAll(turf.centerOfMass(f))[0]
    : turf.coordAll(turf.centerOfMass(parentFeatureForCenter))[0]
  const matrix = compose(
    // translate to map origin
    translate(-originalCenter[0], -originalCenter[1]),
  )
  f.geometry.coordinates[0] = applyToPoints(matrix, f.geometry.coordinates[0])
  return f
}