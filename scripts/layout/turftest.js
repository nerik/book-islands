const turf = require('@turf/turf')
const points = [
  {
    'type': 'Feature',
    'properties': {},
    'geometry': {
      'type': 'Point',
      'coordinates': [
        21.4453125,
        50.064191736659104
      ]
    }
  },
  {
    'type': 'Feature',
    'properties': {},
    'geometry': {
      'type': 'Point',
      'coordinates': [
        21.796875,
        45.336701909968134
      ]
    }
  },
  {
    'type': 'Feature',
    'properties': {},
    'geometry': {
      'type': 'Point',
      'coordinates': [
        38.3203125,
        54.16243396806779
      ]
    }
  },
  {
    'type': 'Feature',
    'properties': {},
    'geometry': {
      'type': 'Point',
      'coordinates': [
        26.71875,
        61.270232790000634
      ]
    }
  },
  {
    'type': 'Feature',
    'properties': {},
    'geometry': {
      'type': 'Point',
      'coordinates': [
        8.4375,
        53.9560855309879
      ]
    }
  },
  {
    'type': 'Feature',
    'properties': {},
    'geometry': {
      'type': 'Point',
      'coordinates': [
        63.984375,
        55.57834467218206
      ]
    }
  },
  {
    'type': 'Feature',
    'properties': {},
    'geometry': {
      'type': 'Point',
      'coordinates': [
        -2.4609375,
        40.44694705960048
      ]
    }
  }
]

const island = {
  'type': 'Feature',
  'properties': {},
  'geometry': {
    'type': 'Polygon',
    'coordinates': [
      [
        [
          -62.22656249999999,
          46.31658418182218
        ],
        [
          -30.234375,
          41.77131167976407
        ],
        [
          -37.265625,
          25.48295117535531
        ],
        [
          -5.625,
          39.639537564366684
        ],
        [
          1.7578125,
          40.17887331434696
        ],
        [
          23.203125,
          42.5530802889558
        ],
        [
          54.4921875,
          44.84029065139799
        ],
        [
          87.5390625,
          41.77131167976407
        ],
        [
          103.0078125,
          48.69096039092549
        ],
        [
          94.21875,
          63.704722429433225
        ],
        [
          71.71875,
          58.63121664342478
        ],
        [
          48.515625,
          66.23145747862573
        ],
        [
          20.0390625,
          63.074865690586634
        ],
        [
          16.171875,
          56.36525013685606
        ],
        [
          -13.0078125,
          56.36525013685606
        ],
        [
          -31.289062500000004,
          48.22467264956519
        ],
        [
          -62.22656249999999,
          46.31658418182218
        ]
      ]
    ]
  }
}
Error.stackTraceLimit = Infinity

const pointMctr = points.map(p => turf.toMercator(p))
const islandMctr = turf.toMercator(island)

const buffers = pointMctr.map(p => turf.toMercator(turf.buffer(turf.toWgs84(p), 500, {
  units: 'kilometers',
  steps: 8
})))

const intersected = buffers.map(b => {
  return turf.intersect(b, islandMctr)
})

const merged = intersected.slice(1).reduce((acc, current) => {
  return turf.union(acc, current)
}, buffers[0])

const mergedWgs = turf.toWgs84(merged)

const mergedArea = turf.area(mergedWgs)
const islandArea = turf.area(island)

mergedWgs.properties = {
  mergedArea,
  islandArea,
  r: mergedArea/islandArea
}


console.log(JSON.stringify(mergedWgs))