/* global d3, _, turf */

const canvas = document.getElementById('canvas')
const context = canvas.getContext('2d')
const island = [
  [
    -27.773437499999996,
    30.44867367928756
  ],
  [
    -27.421875,
    28.459033019728043
  ],
  [
    -27.94921875,
    27.21555620902969
  ],
  [
    -29.003906249999996,
    25.3241665257384
  ],
  [
    -31.289062500000004,
    25.005972656239187
  ],
  [
    -33.046875,
    25.64152637306577
  ],
  [
    -34.80468749999999,
    26.27371402440643
  ],
  [
    -36.5625,
    28.92163128242129
  ],
  [
    -38.67187499999999,
    27.527758206861886
  ],
  [
    -39.375,
    24.206889622398023
  ],
  [
    -39.90234375,
    21.94304553343818
  ],
  [
    -36.9140625,
    19.80805412808859
  ],
  [
    -33.3984375,
    21.779905342529645
  ],
  [
    -27.0703125,
    22.43134015636061
  ],
  [
    -24.08203125,
    19.973348786110602
  ],
  [
    -26.54296875,
    14.604847155053898
  ],
  [
    -39.0234375,
    13.923403897723347
  ],
  [
    -31.81640625,
    7.013667927566642
  ],
  [
    -29.003906249999996,
    12.039320557540572
  ],
  [
    -17.2265625,
    0.3515602939922709
  ],
  [
    -27.24609375,
    0.5273363048115169
  ],
  [
    -30.05859375,
    -0.8788717828324148
  ],
  [
    -29.53125,
    -8.059229627200192
  ],
  [
    -21.97265625,
    -5.7908968128719565
  ],
  [
    -17.578125,
    -14.264383087562637
  ],
  [
    -16.69921875,
    -17.811456088564473
  ],
  [
    -13.7109375,
    -20.3034175184893
  ],
  [
    -7.3828125,
    -16.63619187839765
  ],
  [
    -5.625,
    -8.928487062665504
  ],
  [
    1.7578125,
    0
  ],
  [
    7.55859375,
    2.6357885741666065
  ],
  [
    14.23828125,
    4.039617826768437
  ],
  [
    15.644531250000002,
    2.28455066023697
  ],
  [
    14.589843749999998,
    -0.7031073524364783
  ],
  [
    11.6015625,
    -2.6357885741666065
  ],
  [
    8.7890625,
    -4.214943141390639
  ],
  [
    6.328125,
    -6.489983332670651
  ],
  [
    6.85546875,
    -9.275622176792098
  ],
  [
    8.96484375,
    -9.102096738726443
  ],
  [
    14.589843749999998,
    -8.059229627200192
  ],
  [
    17.05078125,
    -7.18810087117902
  ],
  [
    20.56640625,
    -4.214943141390639
  ],
  [
    24.78515625,
    -2.108898659243126
  ],
  [
    27.24609375,
    0.8788717828324276
  ],
  [
    21.4453125,
    10.833305983642491
  ],
  [
    24.960937499999996,
    17.476432197195518
  ],
  [
    25.3125,
    24.84656534821976
  ],
  [
    17.9296875,
    26.27371402440643
  ],
  [
    8.26171875,
    18.145851771694467
  ],
  [
    -5.80078125,
    23.40276490540795
  ],
  [
    1.9335937499999998,
    26.902476886279832
  ],
  [
    14.0625,
    32.84267363195431
  ],
  [
    10.01953125,
    38.8225909761771
  ],
  [
    5.44921875,
    35.02999636902566
  ],
  [
    -0.52734375,
    33.137551192346145
  ],
  [
    -5.09765625,
    35.88905007936091
  ],
  [
    -8.26171875,
    33.43144133557529
  ],
  [
    -13.18359375,
    32.99023555965106
  ],
  [
    -16.171875,
    34.88593094075317
  ],
  [
    -18.28125,
    32.24997445586331
  ],
  [
    -20.91796875,
    33.43144133557529
  ],
  [
    -25.13671875,
    32.24997445586331
  ],
  [
    -27.773437499999996,
    30.44867367928756
  ]
]

const clusters = [
  [
    -21.796875,
    27.21555620902969
  ],
  [
    0.52734375,
    18.47960905583197
  ],
  [
    -12.3046875,
    -17.978733095556155
  ],
  [
    -14.94140625,
    27.527758206861886
  ]
]
const clusterWeights = [1, .5, .1, .01]
const clusterColors = ['#CDE8B5', '#CAF0FE', '#D8C9FE', '#F9D3E0']



const pip = function (point, vs) {
  // ray-casting algorithm based on
  // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html
  
  var x = point[0], y = point[1]
  
  var inside = false
  for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    var xi = vs[i][0], yi = vs[i][1]
    var xj = vs[j][0], yj = vs[j][1]
      
    var intersect = ((yi > y) != (yj > y))
          && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  
  return inside
}



const RANGE_X = [1, 800]
const RANGE_Y = [1, 800]
const NUM_POINTS = 1000
// const SCALE = 15
let numPoints = 0

const bbox = turf.polygon([[[RANGE_X[0], RANGE_Y[0]], [RANGE_X[1], RANGE_Y[0]], [RANGE_X[1], RANGE_Y[1]], [RANGE_X[0], RANGE_Y[1]], [RANGE_X[0], RANGE_Y[0]]]])

const xMin = d3.min(island.map(p => p[0]))
const xMax = d3.max(island.map(p => p[0]))
const yMin = d3.min(island.map(p => p[1]))
const yMax = d3.max(island.map(p => p[1]))

const scaleX = d3.scaleLinear()
  .domain([xMin, xMax])
  .range(RANGE_X)

const scaleY = d3.scaleLinear()
  .domain([yMin, yMax])
  .range(RANGE_Y)


const islandPoints = island
  .map(p => [scaleX(p[0]), scaleY(p[1])])

const allClusters = clusters
  .map(p => [scaleX(p[0]), scaleY(p[1])])


const newPoints = []
while (numPoints < NUM_POINTS) {
  // const rdx = RANGE_X[0] + Math.random() * (RANGE_X[1] - RANGE_X[0])
  // const rdy = RANGE_Y[0] + Math.random() * (RANGE_Y[1] - RANGE_Y[0])
  const rdx = RANGE_X[0] + Math.random() * (RANGE_X[1] - RANGE_X[0])
  const rdy = RANGE_Y[0] + Math.random() * (RANGE_Y[1] - RANGE_Y[0])
  const rdPt = [rdx, rdy]
  newPoints.push(rdPt)
  numPoints++
  // if (pip(rdPt, islandPoints)) {
  //   newPoints.push(rdPt)
  //   numPoints++
  // }
}

const allPoints = newPoints.concat(islandPoints)

const delaunay = d3.Delaunay.from(allPoints)
const {points, triangles, halfedges} = delaunay






// const voronoi = delaunay.voronoi([xMin, yMin, xMax, yMax])
const voronoi = delaunay.voronoi([RANGE_X[0], RANGE_Y[0], RANGE_X[1], RANGE_Y[1]])

// const rdChan = () => Math.floor(Math.random() * 255)
// const rdColor = () => `rgb(${rdChan()},${rdChan()},${rdChan()})`

const getSharedEdgesWith = (poly1, poly2) => {
  // get unique original polygon points
  const sharedEdges = []

  poly1.forEach(poly1Pt => {
    poly2.forEach(poly2Pt => {
      if (poly1Pt[0] === poly2Pt[0] && poly1Pt[1] === poly2Pt[1]) {
        sharedEdges.push([poly1Pt[0], poly2Pt[1]])
      }
    })
  })
  return _.uniqBy(sharedEdges, v => v.join(','))
}

const getPoly = (v, index) => {
  const pts = v.cellPolygon(index)
  const poly = turf.polygon([pts])
  const int = turf.intersect(bbox, poly)
  return turf.coordAll(int)
}

const cells = []
const getNeighbors = (d, index) => {
  const neighbors = d.neighbors(index)
  const neighborsIndexes = []
  for (let nextValue = neighbors.next(); nextValue.done !== true; nextValue = neighbors.next()) {
    neighborsIndexes.push(nextValue.value)
  }
  // return neighborsIndexes
  // Then, intersect all polygons with bbox
  // Then, used sharedEdges comparison to remove false neighbors
  const filteredNeighbors = neighborsIndexes.filter(neighborIndex => {
    const sharedEdges = getSharedEdgesWith(cells[index].poly, cells[neighborIndex].poly)
    return sharedEdges.length
  })

  return filteredNeighbors
}

for (let j = 0; j < (points.length/2) - 1 ; j++) {
  const coords = [points[j*2], points[j*2+1]]
  const poly = getPoly(voronoi, j)
  // const neighbors = getNeighbors(delaunay, j)

  const shore = islandPoints.find(p => p[0] === coords[0] && p[1] === coords[1]) === undefined ? false : true
  const sea = shore === false && pip(coords, islandPoints) === false
  cells.push({
    index: j,
    poly,
    territory: null,
    shore,
    sea
  })
}

cells.forEach(cell => {
  cell.neighbors = getNeighbors(delaunay, cell.index)
})
console.log(cells)

const territories = allClusters.map((cluster, i) => {
  const startingCellIndex = delaunay.find(cluster[0], cluster[1])
  const territory = {
    index: i,
    weight: clusterWeights[i]
  }
  cells[startingCellIndex].starting = true
  cells[startingCellIndex].territory = i
  return territory
})


const territoriesIterations = _.shuffle(_.flatten(territories.map((t, i) => {
  const weight = Math.round(t.weight * 100)
  return new Array(weight).fill(i)
})))
// const territoriesIterations = [0, 1, 0, 0, 1, 0, 0]
let currentTerritoryIteration = 0

for (let i = 0; i < 15000; i++) {
  const territoryIndex = territoriesIterations[currentTerritoryIteration]
  // const territory = territories[territoryIndex]

  // Find a cell neighbour to the territory
  // 1. Pick a random cell already belonging to the territory
  const territoryCells = _.shuffle(cells.filter(c => c.territory === territoryIndex))
  const territoryRdCell = territoryCells[0]

  // 2. Get random cell neighbours 
  const territoryRdCellNeighborsIndexes = territoryRdCell.neighbors

  const territoryRdCellNeighbors = cells
    .filter(c => territoryRdCellNeighborsIndexes.includes(c.index))
  
  // if random cell is a sea, do not pick another sea (avoids conquering through sea)
  const territoryRdCellNeighborsNotSea = territoryRdCellNeighbors
    . filter(c =>
      territoryRdCell.sea === false || (territoryRdCell.sea === true && c.sea === false)
    )
    
  // 3. Of all neighbours, pick one that is free
  const territoryRdCellNeighborsFree = territoryRdCellNeighborsNotSea
    .filter(c => c.territory === null)
  const pickedCell = _.shuffle(territoryRdCellNeighborsFree)[0]

  if (!territoryRdCellNeighborsFree.length) {
    // console.log('Cant find free neighbour cell for territory', territoryIndex, ' cell:', territoryRdCell.index)
  } else {
    cells[pickedCell.index].territory = territoryIndex
  }



  currentTerritoryIteration++
  if (currentTerritoryIteration >= territoriesIterations.length) {
    currentTerritoryIteration = 0
  }
  const cellsLeft = cells.filter(c => c.territory === null)
  const cellsLeftNoSea = cellsLeft.filter(c => c.sea === false)
  // console.log(cellsLeftNoSea.length)
  if (cellsLeftNoSea.length === 0) {
    // at this point the cells left will be sea cells but they might overlap with island
    // in which case we should continue looking
    // const cellsLeftSea = cellsLeft.filter(c => c.sea === true)
    // cellsLeftSea.forEach(seaCell => {
    //   const t0 = triangles[seaCell.index * 3 + 0]
    //   const t1 = triangles[seaCell.index * 3 + 1]
    //   const t2 = triangles[seaCell.index * 3 + 2]
    //   const p0 = [points[t0 * 2], points[t0 * 2 + 1]]
    //   const p1 = [points[t1 * 2], points[t1 * 2 + 1]]
    //   const p2 = [points[t2 * 2], points[t2 * 2 + 1]]
    //   console.log(p0, p1, p2)
    // })
    console.log('Stopping at', i, 'iterations')
    break
  }
}


// For each territory, get frontier cells
// for each frontier cell, get frontier edge
const allFrontierCells = territories.map(territory => {
  const territoryCells = cells
    .filter(c => c.territory === territory.index)
  const neighborContainers = territoryCells
    .map(c => {
      const neighborsIndexes = c.neighbors
      const neighbors = cells
        .filter(c => neighborsIndexes.includes(c.index))
      const neighborsForeign = neighbors
        .filter(c => c.territory !== territory.index)
      return {
        index: c.index,
        poly: c.poly,
        neighborsForeign
      } 
    })
  // console.log(neighborContainers)
  const frontierCells = neighborContainers.filter(c => c.neighborsForeign.length)
  return frontierCells
})





// const allFrontierSegments = _.flatten(allFrontierCells.map(territoryFrontierCells => {
//   return _.flatten(territoryFrontierCells.map(frontierCell => {
//     // console.log(frontierCell.neighborsForeign)
//     return frontierCell.neighborsForeign.map(foreign => {
//       return getSharedEdgesWith(voronoi, frontierCell.index, foreign.index)
//     })
//   }))
// })).filter(c => c.length)

// console.log(allFrontierSegments)


const territoriesSegments = allFrontierCells.map(territoryFrontierCells => {
  console.log(territoryFrontierCells)
  const segments = []
  territoryFrontierCells.forEach(frontierCell => {
    frontierCell.neighborsForeign.map(foreignCell => {
      console.log(frontierCell, foreignCell)
      const sharedEdges = getSharedEdgesWith(frontierCell.poly, foreignCell.poly)
      if (sharedEdges && sharedEdges.length) {
        segments.push(sharedEdges)
      }
    })
  })
  return _.uniqBy(segments, v => v.join(','))
})

// territoriesSegments.forEach(segs => {

// })

console.log(territoriesSegments)



context.lineWidth = 1



cells.forEach(cell => {
  const poly = cell.poly

  // console.log(cell.territory !== null && allFrontierCells[cell.territory])
  const isFrontier = cell.territory !== null && allFrontierCells[cell.territory].map(c => c.index).includes(cell.index)
  // context.lineWidth = (isFrontier) ? 2 : 1
  // context.strokeStyle = (isFrontier) ? 'blue' : 'grey'
  context.strokeStyle = 'gray'

  context.beginPath()
  const color = (cell.territory === null) ? 'lightgrey' : clusterColors[cell.territory]
  context.fillStyle = color
  context.moveTo(poly[0][0], poly[0][1])
  for (let k = 0; k < poly.length - 1; k++) {
    context.lineTo(poly[k][0], poly[k][1])
  }
  context.fill()
  context.stroke()
  context.closePath()
})

// Delaunay triangles
// context.beginPath()
// context.lineWidth = 1
// context.strokeStyle = 'orange'
// for (let i = 0, n = triangles.length/3; i < n; ++i) {
//   const t0 = triangles[i * 3 + 0]
//   const t1 = triangles[i * 3 + 1]
//   const t2 = triangles[i * 3 + 2]
//   const p0 = [points[t0 * 2], points[t0 * 2 + 1]]
//   const p1 = [points[t1 * 2], points[t1 * 2 + 1]]
//   const p2 = [points[t2 * 2], points[t2 * 2 + 1]]
//   context.moveTo(p0[0], p0[1])
//   context.lineTo(p1[0], p1[1])
//   context.lineTo(p2[0], p2[1])
// }
// context.closePath()
// context.stroke()



// Island
context.beginPath()
context.strokeStyle = 'black'
context.lineWidth = 3
context.moveTo(islandPoints[0][0], islandPoints[0][1])
for (let i = 1, n = islandPoints.length - 2; i < n; ++i) {
  context.lineTo(islandPoints[i][0], islandPoints[i][1])
}
context.closePath()
context.stroke()


// Internal edges of triangulation
// context.beginPath()
// context.strokeStyle = 'green'
// context.lineWidth = 1
// for (let i = 0, n = halfedges.length; i < n; ++i) {
//   const j = halfedges[i]
//   if (j < i) continue
//   const ti = triangles[i]
//   const tj = triangles[j]
//   context.moveTo(points[ti * 2], points[ti * 2 + 1])
//   context.lineTo(points[tj * 2], points[tj * 2 + 1])
// }
// context.closePath()
// context.stroke()



// Frontier segments

context.beginPath()
context.strokeStyle = 'red'
context.lineWidth = 2
territoriesSegments.forEach(territorySegs => {
  territorySegs.forEach(seg => {
    context.moveTo(seg[0][0], seg[0][1])
    context.lineTo(seg[1][0], seg[1][1])
  })
})
context.closePath()
context.stroke()
