const turf = require('@turf/turf')
const g = {
  'type': 'FeatureCollection',
  'features': [
    {
      'type': 'Feature',
      'properties': {},
      'geometry': {
        'type': 'Point',
        'coordinates': [
          130.078125,
          57.89149735271034
        ]
      }
    },
    {
      'type': 'Feature',
      'properties': {},
      'geometry': {
        'type': 'Point',
        'coordinates': [
          114.60937499999999,
          68.00757101804004
        ]
      }
    },
    {
      'type': 'Feature',
      'properties': {},
      'geometry': {
        'type': 'Point',
        'coordinates': [
          108.984375,
          60.413852350464914
        ]
      }
    },
    {
      'type': 'Feature',
      'properties': {},
      'geometry': {
        'type': 'Point',
        'coordinates': [
          122.16796875,
          63.6267446447533
        ]
      }
    },
    {
      'type': 'Feature',
      'properties': {},
      'geometry': {
        'type': 'Point',
        'coordinates': [
          135,
          66.51326044311185
        ]
      }
    },
    {
      'type': 'Feature',
      'properties': {},
      'geometry': {
        'type': 'Point',
        'coordinates': [
          156.09375,
          66.08936427047088
        ]
      }
    },
    {
      'type': 'Feature',
      'properties': {},
      'geometry': {
        'type': 'Point',
        'coordinates': [
          149.58984375,
          70.4367988185464
        ]
      }
    },
    {
      'type': 'Feature',
      'properties': {},
      'geometry': {
        'type': 'Point',
        'coordinates': [
          167.16796875,
          71.18775391813158
        ]
      }
    }
  ]
}

console.log(JSON.stringify(turf.concave(g)))