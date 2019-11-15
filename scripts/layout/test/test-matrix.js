const { scale, rotate, translate, compose, applyToPoints } = require('transformation-matrix')
const turf = require('@turf/turf')

const feature = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-18.28125, 62.2679226294176],
        [36.9140625, 61.10078883158897],
        [37.265625, 80.05804956215623],
        [-18.28125, 62.2679226294176],
      ],
    ],
  },
}

const newCenter = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Point',
    coordinates: [135, -24.846565348219734],
  },
}

const featureMctr = turf.toMercator(feature)
const featureCenterMctr = turf.center(featureMctr)
const newCenterMctr = turf.toMercator(newCenter)

const offsetLng = newCenterMctr.geometry.coordinates[0] - featureCenterMctr.geometry.coordinates[0]
const offsetLat = newCenterMctr.geometry.coordinates[1] - featureCenterMctr.geometry.coordinates[1]

// latest first
const matrix = compose(
  translate(newCenterMctr.geometry.coordinates[0], newCenterMctr.geometry.coordinates[1]),
  scale(-0.3, 0.3),
  translate(-featureCenterMctr.geometry.coordinates[0], -featureCenterMctr.geometry.coordinates[1])
  // translate(offsetLng, offsetLat),
)

featureMctr.geometry.coordinates[0] = applyToPoints(matrix, featureMctr.geometry.coordinates[0])

const unprojected = turf.toWgs84(featureMctr)

console.log(JSON.stringify(unprojected))

let matrix2 = compose(scale(2), translate(10, 10))

const pt = applyToPoints(matrix2, [
  [-20, -20],
  [0, 0],
])
console.log(pt)
