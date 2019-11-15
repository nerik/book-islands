/* global d3, _, turf */

const canvas = document.getElementById('canvas')
const canvas2 = document.getElementById('canvas2')
const context = canvas.getContext('2d')
const context2 = canvas2.getContext('2d')
const island = [
  [-0.06154490635834908, -8.086378271182333],
  [-0.05712830635834777, -8.079465764229482],
  [-0.05729490635834961, -8.074172892073596],
  [-0.06955050635834677, -8.069799683363458],
  [-0.07672270635834562, -8.063686257330463],
  [-0.07872270635834695, -8.064016780561218],
  [-0.08188930635834409, -8.067987834808404],
  [-0.09272270635834619, -8.071788005402507],
  [-0.09246710635834696, -8.075335003097335],
  [-0.09713370635834842, -8.079631130241829],
  [-0.08335050635834788, -8.086069742238701],
  [-0.07980590635834778, -8.089919825297546],
  [-0.07363370635834622, -8.09239839392158],
  [-0.06880050635834627, -8.092073403242958],
  [-0.06696710635834678, -8.09406181840137],
  [-0.06546710635834578, -8.09239839392158],
  [-0.05888370635834983, -8.092172546195568],
  [-0.06237270635834883, -8.089523255553246],
  [-0.06154490635834908, -8.086378271182333],
]

const clusters = [
  [-0.05718976607462878, -8.078628379061712],
  [-0.09292326424397856, -8.079591102771786],
  [-0.07505651515930412, -8.07910974120378],
]
const clusterWeights = [1, 1, 1]
const clusterColors = ['#CDE8B5', '#CAF0FE', '#D8C9FE', '#F9D3E0', '#FDE0D7']
const clusterColors2 = ['#96D35F', '#3AF5F5', '#864DFD', '#ED719E', '#F57B49']
const RANGE_X = [1, 400]
const RANGE_Y = [1, 300]
const NUM_POINTS = 1000
const MAX_CONQUEST_ITERATIONS = 1000000

const pip = function(point, vs) {
  // ray-casting algorithm based on
  // http://www.ecse.rpi.edu/Homepages/wrf/Research/Short_Notes/pnpoly.html

  var x = point[0],
    y = point[1]

  var inside = false
  for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    var xi = vs[i][0],
      yi = vs[i][1]
    var xj = vs[j][0],
      yj = vs[j][1]

    var intersect = yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }

  return inside
}

let numPoints = 0

const bbox = turf.polygon([
  [
    [RANGE_X[0], RANGE_Y[0]],
    [RANGE_X[1], RANGE_Y[0]],
    [RANGE_X[1], RANGE_Y[1]],
    [RANGE_X[0], RANGE_Y[1]],
    [RANGE_X[0], RANGE_Y[0]],
  ],
])

const xMin = d3.min(island.map((p) => p[0]))
const xMax = d3.max(island.map((p) => p[0]))
const yMin = d3.min(island.map((p) => p[1]))
const yMax = d3.max(island.map((p) => p[1]))
console.log(xMin, xMax, yMin, yMax)

const scaleX = d3
  .scaleLinear()
  .domain([xMin, xMax])
  .range(RANGE_X)

const scaleY = d3
  .scaleLinear()
  .domain([yMax, yMin])
  .range(RANGE_Y)

const islandPoints = island.map((p) => [scaleX(p[0]), scaleY(p[1])])

const allClusters = clusters.map((p) => {
  return [scaleX(p[0]), scaleY(p[1])]
})

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

const getSharedEdgesWith = (poly1, poly2) => {
  // get unique original polygon points
  const sharedEdges = []

  poly1.forEach((poly1Pt) => {
    poly2.forEach((poly2Pt) => {
      if (poly1Pt[0] === poly2Pt[0] && poly1Pt[1] === poly2Pt[1]) {
        sharedEdges.push([poly1Pt[0], poly2Pt[1]])
      }
    })
  })
  return _.uniqBy(sharedEdges, (v) => v.join(','))
}

const getPoly = (v, index) => {
  const pts = v.cellPolygon(index)
  const poly = turf.polygon([pts])
  const int = turf.intersect(bbox, poly)
  return turf.coordAll(int)
}

const getNeighbors = (d, index) => {
  const neighbors = d.neighbors(index)
  const neighborsIndexes = []
  for (let nextValue = neighbors.next(); nextValue.done !== true; nextValue = neighbors.next()) {
    neighborsIndexes.push(nextValue.value)
  }
  const cleanedUpNeighbors = neighborsIndexes.filter((neighborIndex) => {
    if (!cells[neighborIndex]) {
      return false
    }
    return true
  })
  // return neighborsIndexes
  // Then, intersect all polygons with bbox
  // Then, used sharedEdges comparison to remove false neighbors
  const filteredNeighbors = cleanedUpNeighbors.filter((neighborIndex) => {
    const sharedEdges = getSharedEdgesWith(cells[index].poly, cells[neighborIndex].poly)
    return sharedEdges.length
  })

  return filteredNeighbors
}

const isPtInBorder = (pt) => {
  return (
    pt[0] === RANGE_X[0] || pt[1] === RANGE_Y[0] || pt[0] === RANGE_X[1] || pt[1] === RANGE_Y[1]
  )
}

let t = performance.now()

const delaunay = d3.Delaunay.from(allPoints)
const { points } = delaunay
const voronoi = delaunay.voronoi([RANGE_X[0], RANGE_Y[0], RANGE_X[1], RANGE_Y[1]])

const cells = []
for (let j = 0; j < points.length / 2 - 1; j++) {
  const coords = [points[j * 2], points[j * 2 + 1]]
  // console.log(j, points.length/2)
  let poly
  try {
    poly = getPoly(voronoi, j)
  } catch (e) {
    console.log('Faulty voronoi')
    cells.push(null)
    continue
  }
  const shore =
    islandPoints.find((p) => p[0] === coords[0] && p[1] === coords[1]) === undefined ? false : true
  const sea = shore === false && pip(coords, islandPoints) === false
  // if (sea) {
  //   cells.push(null)
  // }
  cells.push({
    index: j,
    poly,
    territory: null,
    shore,
    sea,
  })
}

if (cells.filter((c) => c === null).length) {
  console.log('Missing cells:', cells.filter((c) => c === null).length)
}

cells
  .filter((c) => c !== null)
  .forEach((cell) => {
    cell.neighbors = getNeighbors(delaunay, cell.index)
  })

console.log('Delaunay done in ', performance.now() - t)

let currentPickedCount = 0
const territories = allClusters.map((cluster, i) => {
  const startingCellIndex = delaunay.find(cluster[0], cluster[1])
  const territory = {
    index: i,
    weight: clusterWeights[i],
    cellsIndexes: [startingCellIndex],
    nonLandLockedCellsIndexes: [startingCellIndex],
  }
  cells[startingCellIndex].starting = true
  cells[startingCellIndex].territory = i
  cells[startingCellIndex].order = currentPickedCount
  currentPickedCount++
  return territory
})
let freeCellsIndexes = cells.filter((c) => c !== null && c.territory === null).map((c) => c.index)
let freeLandCellsIndexes = cells
  .filter((c) => c !== null && c.territory === null && c.sea === false)
  .map((c) => c.index)
let freeLandPureCellsIndexes = cells
  .filter((c) => c !== null && c.territory === null && c.sea === false && c.shore === false)
  .map((c) => c.index)

const territoriesIterations = _.shuffle(
  _.flatten(
    territories.map((t, i) => {
      const weight = Math.round(t.weight * 100)
      return new Array(weight).fill(i)
    })
  )
)
// const territoriesIterations = [0, 1, 0, 0, 1, 0, 0]
let currentTerritoryIteration = 0

t = performance.now()

let iterationsSinceSuccess = 0

for (let i = 0; i < MAX_CONQUEST_ITERATIONS; i++) {
  const territoryIndex = territoriesIterations[currentTerritoryIteration]
  const currentTerritory = territories[territoryIndex]
  // const territory = territories[territoryIndex]

  // Find a cell neighbour to the territory
  // 1. Pick a random cell already belonging to the territory
  const territoryCellsIndexes = currentTerritory.nonLandLockedCellsIndexes
  const numTerritoryCells = territoryCellsIndexes.length
  const rdTerritoryCell = Math.floor(Math.random() * numTerritoryCells)
  const territoryRdCellIndex = territoryCellsIndexes[rdTerritoryCell]
  const territoryRdCell = cells[territoryRdCellIndex]

  // 2. Get random cell neighbours
  const territoryRdCellNeighborsIndexes = territoryRdCell.neighbors

  // if random cell is a sea, do not pick another sea (avoids conquering through sea)
  const territoryRdCellNeighborsLandIndexes =
    territoryRdCell.sea === false
      ? territoryRdCellNeighborsIndexes
      : // : _.intersection(territoryRdCellNeighborsIndexes, freeLandCellsIndexes)
        _.intersection(territoryRdCellNeighborsIndexes, freeLandPureCellsIndexes)

  // pick cells that are neighbours of random territory cell
  const territoryRdCellFreeNeighborsLandIndexes = _.intersection(
    territoryRdCellNeighborsLandIndexes,
    freeCellsIndexes
  )

  const numTerritoryRdCellNeighborsFree = territoryRdCellFreeNeighborsLandIndexes.length
  if (numTerritoryRdCellNeighborsFree === 0) {
    // console.log('Cant find free neighbour cell for territory', territoryIndex, ' cell:', territoryRdCell.index)

    // try to remove current cell from the pool (nonLandLockedCellsIndexes)
    // when it is completely surrounded by same-territory cells
    const pickedCellNeighbors = territoryRdCell.neighbors
    const pickedCellNeighborsOtherTerritory = pickedCellNeighbors.filter(
      (cellIndex) => cells[cellIndex].territory !== territoryIndex
    )
    if (pickedCellNeighborsOtherTerritory.length === 0) {
      const removeAt = currentTerritory.nonLandLockedCellsIndexes.indexOf(territoryRdCell.index)
      currentTerritory.nonLandLockedCellsIndexes.splice(removeAt, 1)
      // freeCellsIndexes.splice(freeCellsIndexes.indexOf(territoryRdCell.index), 1)
      // if (territoryRdCell.sea === false) {
      //   freeLandCellsIndexes.splice(freeLandCellsIndexes.indexOf(territoryRdCell.index), 1)
      //   freeLandPureCellsIndexes.splice(freeLandCellsIndexes.indexOf(territoryRdCell.index), 1)
      // }
    }
    iterationsSinceSuccess++
  } else {
    iterationsSinceSuccess = 0
    const pickedCellIndex =
      territoryRdCellFreeNeighborsLandIndexes[
        Math.floor(Math.random() * numTerritoryRdCellNeighborsFree)
      ]
    const pickedCell = cells[pickedCellIndex]
    cells[pickedCellIndex].territory = territoryIndex
    cells[pickedCellIndex].order = currentPickedCount
    currentPickedCount++
    currentTerritory.cellsIndexes.push(pickedCellIndex)
    currentTerritory.nonLandLockedCellsIndexes.push(pickedCellIndex)
    freeCellsIndexes.splice(freeCellsIndexes.indexOf(pickedCellIndex), 1)
    if (pickedCell.sea === false) {
      freeLandCellsIndexes.splice(freeLandCellsIndexes.indexOf(pickedCellIndex), 1)
      freeLandPureCellsIndexes.splice(freeLandCellsIndexes.indexOf(pickedCellIndex), 1)
    }
  }

  currentTerritoryIteration++
  if (currentTerritoryIteration >= territoriesIterations.length) {
    currentTerritoryIteration = 0
  }

  if (freeLandCellsIndexes.length === 0) {
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

  // Sometimes, territories might be completely drawn but somehow free land cells counter is not === 0
  // so it gets stuck at max iterations.
  if (iterationsSinceSuccess >= 1000) {
    console.log('Couldnt find cells after trying ', iterationsSinceSuccess, 'times, aborting')
    break
  }
}
console.log('Conquest done in ', performance.now() - t)

t = performance.now()
// For each territory, get frontier cells
// for each frontier cell, get frontier edge

territories.forEach((territory) => {
  const territoryCells = cells.filter((c) => c !== null && c.territory === territory.index)

  // get frontier cells
  const neighborContainers = territoryCells.map((c) => {
    const neighborsIndexes = c.neighbors
    const neighbors = cells.filter((c) => c !== null && neighborsIndexes.includes(c.index))
    const neighborsForeign = neighbors.filter((c) => c.territory !== territory.index)
    return {
      index: c.index,
      poly: c.poly,
      neighborsForeign,
    }
  })
  territory.frontierCells = neighborContainers.filter((c) => c.neighborsForeign.length)

  // get border cells
  territory.borderCells = territoryCells.filter((c) => {
    return c.poly.some((p) => isPtInBorder(p))
  })
})

const territoriesBorderSegments = []
const territoriesSegments = territories.map((territory) => {
  const segments = []
  const borderSegments = []

  // collect frontier segs
  territory.frontierCells.forEach((frontierCell) => {
    frontierCell.neighborsForeign.map((foreignCell) => {
      // console.log(frontierCell, foreignCell)
      const sharedEdges = getSharedEdgesWith(frontierCell.poly, foreignCell.poly)
      if (sharedEdges && sharedEdges.length) {
        segments.push(sharedEdges)
      }
    })
  })

  // collect border segs
  territory.borderCells.forEach((edgeCell) => {
    const borderPts = []
    edgeCell.poly.forEach((pt) => {
      if (isPtInBorder(pt)) {
        borderPts.push(pt)
      }
    })
    if (borderPts.length) {
      const uniqBorderPts = _.uniqBy(borderPts, (v) => v.join(','))
      borderSegments.push(uniqBorderPts)
      segments.push(uniqBorderPts)
    }
  })
  territoriesBorderSegments[territory.index] = borderSegments
  const uniqSegments = _.uniqBy(segments, (v) => v.join(','))

  // Now to create ordered (ie segemnts follow in order) polygons
  const firstSeg = uniqSegments.splice(0, 1)[0]
  const polygonOrderedSegs = [firstSeg]
  let currentEnd = firstSeg[1]

  let cnt = 0
  while (uniqSegments.length) {
    // console.log(lastOpenLine.end)
    // try to find next seg for lastOpenLine
    const nextSegFromEndIndex = uniqSegments.findIndex(
      (seg) =>
        (seg[0][0] === currentEnd[0] && seg[0][1] === currentEnd[1]) ||
        (seg[1][0] === currentEnd[0] && seg[1][1] === currentEnd[1])
    )
    if (nextSegFromEndIndex > -1) {
      const nextSeg = uniqSegments.splice(nextSegFromEndIndex, 1)[0]
      const nextSegReordered =
        nextSeg[0][0] === currentEnd[0] && nextSeg[0][1] === currentEnd[1]
          ? [nextSeg[0], nextSeg[1]]
          : [nextSeg[1], nextSeg[0]]
      polygonOrderedSegs.push(nextSegReordered)
      currentEnd = nextSegReordered[1]
    }
    if (nextSegFromEndIndex === -1) {
      console.log(polygonOrderedSegs, uniqSegments)
      // currentEnd = uniqSegments.splice(0, 1)[0][1]
      currentEnd = firstSeg[1]
      break
    }

    if (/*nextSegFromEndIndex === -1 || */ !uniqSegments.length) {
      // console.log(polygonOrderedSegs, uniqSegments.length)
      break
    }
    // if not found, create new line with any

    cnt++
    if (cnt > 10000) {
      console.warn('Could not create ordered polygons, stopping to avoid crashing')
      break
    }
  }

  return polygonOrderedSegs
})

const geoJSONIsland = turf.buffer(turf.lineToPolygon(turf.lineString(island)), 0.01)
const geoJSONPolygons = territoriesSegments.map((orderedSegs, i) => {
  const pts = []
  for (let i = 0; i < orderedSegs.length; i++) {
    // p => [scaleX(p[0]), scaleY(p[1])]
    const segStart = orderedSegs[i][0]
    // const pt = turf.point([scaleX.invert(segStart[0]), scaleY.invert(segStart[1])])
    const pt = [scaleX.invert(segStart[0]), scaleY.invert(segStart[1])]
    pts.push(pt)
  }
  const lineString = turf.lineString(pts)
  const poly = turf.lineToPolygon(lineString)
  try {
    const intersectedPoly = turf.intersect(poly, geoJSONIsland)
    if (!intersectedPoly) {
      console.warn('Territory does not intersect with island')
      return null
    }
    intersectedPoly.properties.id = i
    return intersectedPoly
  } catch (e) {
    console.log(e)
    console.log(JSON.stringify(poly))
    return null
  }
  // return JSON.stringify(turf.featureCollection([poly]))
})

const geoJSON = turf.featureCollection(geoJSONPolygons.filter((p) => p !== null))
// console.log(JSON.stringify(geoJSON))

// console.log(territoriesSegments)

console.log('Segmenting done in ', performance.now() - t)

let currentAnimStep = 0
context.lineWidth = 1

const drawCell = (cell) => {
  const poly = cell.poly

  // console.log(cell.territory !== null && allFrontierCells[cell.territory])
  // const isFrontier = cell.territory !== null && allFrontierCells[cell.territory].map(c => c.index).includes(cell.index)
  // context.lineWidth = (isFrontier) ? 2 : 1
  // context.strokeStyle = (isFrontier) ? 'blue' : 'grey'
  context.strokeStyle = 'gray'

  context.beginPath()
  let color = cell.territory === null ? 'lightgrey' : clusterColors[cell.territory]
  if (cell.starting) {
    color = clusterColors2[cell.territory]
  }
  context.fillStyle = color
  context.moveTo(poly[0][0], poly[0][1])
  for (let k = 0; k < poly.length - 1; k++) {
    context.lineTo(poly[k][0], poly[k][1])
  }
  context.stroke()
  context.fill()
  context.closePath()
}

const drawCells = () => {
  cells.filter((c) => c !== null).forEach((cell) => drawCell(cell))
}
const animateCells = (cb) => {
  const interval = setInterval(() => {
    const cell = cells.filter((c) => c !== null).find((c) => c.order === currentAnimStep)
    if (cell) {
      drawCell(cell)
      currentAnimStep++
    } else {
      clearInterval(interval)
      cb()
    }
  }, 0.1)
}

console.log(territoriesSegments)

const drawTerritories = () => {
  context.lineWidth = 2
  territoriesSegments.forEach((territorySegs, i) => {
    context.beginPath()
    const color = clusterColors[i]
    // context.strokeStyle = color
    context.strokeStyle = 'red'
    territorySegs.forEach((seg) => {
      context.moveTo(seg[0][0], seg[0][1])
      context.lineTo(seg[1][0], seg[1][1])
    })
    context.closePath()
    context.stroke()
  })

  context.lineWidth = 2
  territoriesBorderSegments.forEach((territorySegs, i) => {
    context.beginPath()
    const color = clusterColors[i]
    // context.strokeStyle = color
    context.strokeStyle = 'green'
    territorySegs.forEach((seg) => {
      context.moveTo(seg[0][0], seg[0][1])
      context.lineTo(seg[1][0], seg[1][1])
    })
    context.closePath()
    context.stroke()
  })
}

drawCells()
drawTerritories()
// animateCells(drawTerritories)

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
context2.beginPath()
context2.strokeStyle = 'black'
context2.lineWidth = 1
context2.moveTo(islandPoints[0][0], islandPoints[0][1])
for (let i = 1, n = islandPoints.length - 2; i < n; ++i) {
  context2.lineTo(islandPoints[i][0], islandPoints[i][1])
}
context2.closePath()
context2.stroke()

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

// Capitals
context2.strokeStyle = 'black'
context2.lineWidth = 1
allClusters.forEach((cluster, i) => {
  context2.beginPath()
  context2.fillStyle = clusterColors2[i]
  // context2.moveTo(islandPoints[0][0], islandPoints[0][1])
  // for (let i = 1, n = islandPoints.length - 2; i < n; ++i) {
  //   context2.lineTo(islandPoints[i][0], islandPoints[i][1])
  // }
  context2.fillRect(cluster[0] - 8, cluster[1] - 8, 15, 15)
  context2.strokeRect(cluster[0] - 8, cluster[1] - 8, 15, 15)
  context2.fillStyle = 'black'
  context2.fillRect(cluster[0] - 2, cluster[1] - 2, 4, 4)
  context2.closePath()
})
