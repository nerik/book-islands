const turf = require('@turf/turf')
const _ = require('lodash')
const d3 = require('d3')
const d3Delaunay = require('d3-delaunay')
const {
  performance,

} = require('perf_hooks')

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

const getPoly = (v, index, bbox) => {
  const pts = v.cellPolygon(index)
  const poly = turf.polygon([pts])
  const int = turf.intersect(bbox, poly)
  return turf.coordAll(int)
}

const getNeighbors = (d, index, cells) => {
  const neighbors = d.neighbors(index)
  const neighborsIndexes = []
  for (let nextValue = neighbors.next(); nextValue.done !== true; nextValue = neighbors.next()) {
    neighborsIndexes.push(nextValue.value)
  }
  const cleanedUpNeighbors = neighborsIndexes.filter(neighborIndex => {
    if (!cells[neighborIndex]) {
      return false
    }
    return true
  })
  // return neighborsIndexes
  // Then, intersect all polygons with bbox
  // Then, used sharedEdges comparison to remove false neighbors
  const filteredNeighbors = cleanedUpNeighbors.filter(neighborIndex => {
    const sharedEdges = getSharedEdgesWith(cells[index].poly, cells[neighborIndex].poly)
    return sharedEdges.length
  })

  return filteredNeighbors
}





const drawPreview = (cells, territoriesSegments, territoriesBorderSegments, isMulti) => {
  console.log('draw prev')
  const { createCanvas } = require('canvas')
  var fs = require('fs')

  var canvas = createCanvas(1000, 1000, 'png')
  var context = canvas.getContext('2d')


  const drawCell = (cell) => {
    const poly = cell.poly
  
    // console.log(cell.territory !== null && allFrontierCells[cell.territory])
    // const isFrontier = cell.territory !== null && allFrontierCells[cell.territory].map(c => c.index).includes(cell.index)
    // context.lineWidth = (isFrontier) ? 2 : 1
    // context.strokeStyle = (isFrontier) ? 'blue' : 'grey'
    context.strokeStyle = 'gray'
  
    context.beginPath()
    let color = 'lightgrey'

    context.fillStyle = color
    context.moveTo(poly[0][0], poly[0][1])
    for (let k = 0; k < poly.length - 1; k++) {
      context.lineTo(poly[k][0], poly[k][1])
    }
    context.stroke()
    context.fill()
    context.closePath()
  }
  
  
  cells.filter(c => c !== null).forEach(cell => drawCell(cell))
  console.log(isMulti)
  context.lineWidth = 2
  territoriesSegments
    .filter(($, i) => isMulti.includes(i))
    .forEach((polygonsSegs) => {
      polygonsSegs.forEach((polygonSegs) => {
        context.beginPath()
        // const color = clusterColors[i]
        // context.strokeStyle = color
        context.strokeStyle = 'red'
        polygonSegs.forEach(seg => {
          context.moveTo(seg[0][0], seg[0][1])
          context.lineTo(seg[1][0], seg[1][1])
        })
        context.closePath()
        context.stroke()
      })
    })

  // context.lineWidth = 2
  // territoriesBorderSegments.forEach((territorySegs, i) => {
  //   context.beginPath()
  //   // const color = clusterColors[i]
  //   // context.strokeStyle = color
  //   context.strokeStyle = 'green'
  //   territorySegs.forEach(seg => {
  //     context.moveTo(seg[0][0], seg[0][1])
  //     context.lineTo(seg[1][0], seg[1][1])
  //   })
  //   context.closePath()
  //   context.stroke()
  // })

  var buf = canvas.toBuffer()
  fs.writeFileSync('./test2.png', buf)
}





const isPtInBorder = (pt, rangeX, rangeY) => {
  return (
    pt[0] === rangeX[0] ||
      pt[1] === rangeY[0] ||
      pt[0] === rangeX[1] ||
      pt[1] === rangeY[1])
}

const MAX_CONQUEST_ITERATIONS = 1000000

module.exports = (clusterPoints, clusterWeights, island) => {
  const islandBbox = turf.bbox(island)
  const islandW = islandBbox[2] - islandBbox[0]
  const islandH = islandBbox[3] - islandBbox[1]
  // const rangeX = [1, islandW * 10000]
  // const rangeY = [1, islandH * 10000]
  const rangeX = [1, 1000]
  const rangeY = [1, 1000]
  // const totalPoints = Math.max(1000, Math.round(islandW * islandH * .005))
  const totalPoints = Math.max(3000, Math.round(islandW * islandH * 200000))
  console.log(totalPoints)
  // console.log(totalPoints, rangeX, rangeY)

  const islandCoords = island.geometry.coordinates[0]

  const xMin = d3.min(islandCoords.map(p => p[0]))
  const xMax = d3.max(islandCoords.map(p => p[0]))
  const yMin = d3.min(islandCoords.map(p => p[1]))
  const yMax = d3.max(islandCoords.map(p => p[1]))
  // console.log(xMin, xMax, yMin, yMax)

  const scaleX = d3.scaleLinear()
    .domain([xMin, xMax])
    .range(rangeX)

  const scaleY = d3.scaleLinear()
    .domain([yMax, yMin])
    .range(rangeY)

  // generate noise
  const newPoints = []
  let numPoints = 0
  while (numPoints < totalPoints) {
    const rdx = rangeX[0] + Math.random() * (rangeX[1] - rangeX[0])
    const rdy = rangeY[0] + Math.random() * (rangeY[1] - rangeY[0])
    const rdPt = [rdx, rdy]
    newPoints.push(rdPt)
    numPoints++
  }

  const islandPoints = islandCoords
    .map(p => [scaleX(p[0]), scaleY(p[1])])
  

  const allClusters = clusterPoints
    .map(f => {
      const p = f.geometry.coordinates
      return [scaleX(p[0]), scaleY(p[1])]
    })

  const allPoints = newPoints.concat(islandPoints)




  // Generate delaunay trianngulation + voronoi
  let t = performance.now()
  const delaunay = d3Delaunay.Delaunay.from(allPoints)
  const {points} = delaunay
  const voronoi = delaunay.voronoi([rangeX[0], rangeY[0], rangeX[1], rangeY[1]])

  // prepare data structures
  const cells = []
  const bbox = turf.polygon([[[rangeX[0], rangeY[0]], [rangeX[1], rangeY[0]], [rangeX[1], rangeY[1]], [rangeX[0], rangeY[1]], [rangeX[0], rangeY[0]]]])

  for (let j = 0; j < (points.length/2) - 1 ; j++) {
    const coords = [points[j*2], points[j*2+1]]
    let poly
    try {
      poly = getPoly(voronoi, j, bbox)
    }  catch(e) { 
      console.log('Faulty voronoi')
      cells.push(null)
      continue
    }
    const shore = islandPoints.find(p => p[0] === coords[0] && p[1] === coords[1]) === undefined ? false : true
    const sea = shore === false && pip(coords, islandPoints) === false
    // if (sea) {
    //   cells.push(null)
    // }
    cells.push({
      index: j,
      poly,
      territory: null,
      shore,
      sea
    })
  }
  if (cells.filter(c => c === null).length) {
    console.log('Missing cells:', cells.filter(c => c === null).length)
  }
  
  cells.filter(c => c !== null).forEach(cell => {
    cell.neighbors = getNeighbors(delaunay, cell.index, cells)
  })
  
  // console.log('Delaunay done in ', performance.now() - t)


  // Conquest ---
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
  let freeCellsIndexes = cells.filter(c => c !== null && c.territory === null).map(c => c.index)
  let freeLandCellsIndexes = cells.filter(c => c !== null && c.territory === null && c.sea === false).map(c => c.index)
  let freeLandPureCellsIndexes = cells.filter(c => c !== null && c.territory === null && c.sea === false && c.shore === false).map(c => c.index)

  const territoriesIterations = _.shuffle(_.flatten(territories.map((t, i) => {
    const weight = Math.round(t.weight * 100)
    return new Array(weight).fill(i)
  })))

  
  t = performance.now()
  
  let currentTerritoryIteration = 0
  let iterationsSinceSuccess = 0

  for (let i = 0; i < MAX_CONQUEST_ITERATIONS; i++) {
    const territoryIndex = territoriesIterations[currentTerritoryIteration]
    const currentTerritory = territories[territoryIndex]
  
    // Find a cell neighbour to the territory
    // 1. Pick a random cell already belonging to the territory
    const territoryCellsIndexes = currentTerritory.nonLandLockedCellsIndexes
    const numTerritoryCells = territoryCellsIndexes.length
    const rdTerritoryCell = Math.floor(Math.random()*numTerritoryCells)
    const territoryRdCellIndex = territoryCellsIndexes[rdTerritoryCell]
    const territoryRdCell = cells[territoryRdCellIndex]
  
    // 2. Get random cell neighbours 
    const territoryRdCellNeighborsIndexes = territoryRdCell.neighbors
    
    // if random cell is a sea, do not pick another sea (avoids conquering through sea)
    const territoryRdCellNeighborsLandIndexes = (territoryRdCell.sea === false) 
      ? territoryRdCellNeighborsIndexes
      : _.intersection(territoryRdCellNeighborsIndexes, freeLandPureCellsIndexes)
  
    // pick cells that are neighbours of random territory cell
    const territoryRdCellFreeNeighborsLandIndexes = _.intersection(territoryRdCellNeighborsLandIndexes, freeCellsIndexes)
  
    const numTerritoryRdCellNeighborsFree = territoryRdCellFreeNeighborsLandIndexes.length
    if (numTerritoryRdCellNeighborsFree === 0) {
      // console.log('Cant find free neighbour cell for territory', territoryIndex, ' cell:', territoryRdCell.index)
  
      // try to remove current cell from the pool (nonLandLockedCellsIndexes)
      // when it is completely surrounded by same-territory cells
      const pickedCellNeighbors = territoryRdCell.neighbors
      const pickedCellNeighborsOtherTerritory = pickedCellNeighbors.filter(cellIndex => cells[cellIndex].territory !== territoryIndex)
      if (pickedCellNeighborsOtherTerritory.length === 0) {
        const removeAt = currentTerritory.nonLandLockedCellsIndexes.indexOf(territoryRdCell.index)
        currentTerritory.nonLandLockedCellsIndexes.splice(removeAt, 1)
      }
      iterationsSinceSuccess++
    } else {
      iterationsSinceSuccess = 0
      const pickedCellIndex = territoryRdCellFreeNeighborsLandIndexes[Math.floor(Math.random()*numTerritoryRdCellNeighborsFree)]
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
      // console.log('Stopping at', i, 'iterations')
      break
    }
  
    // Sometimes, territories might be completely drawn but somehow free land cells counter is not === 0 
    // so it gets stuck at max iterations. 
    if (iterationsSinceSuccess >= 1000) {
      // console.log('Couldnt find cells after trying ', iterationsSinceSuccess, 'times, aborting')
      break
    }
  }
  // console.log('Conquest done in ', performance.now() - t)





  // Collect geometries/segmenting -----
  t = performance.now()
  territories.forEach(territory => {
    const territoryCells = cells
      .filter(c => c !== null && c.territory === territory.index)
    
    // get frontier cells
    const neighborContainers = territoryCells
      .map(c => {
        const neighborsIndexes = c.neighbors
        const neighbors = cells
          .filter(c => c !== null && neighborsIndexes.includes(c.index))
        const neighborsForeign = neighbors
          .filter(c => c.territory !== territory.index)
        return {
          index: c.index,
          poly: c.poly,
          neighborsForeign
        } 
      })
    territory.frontierCells = neighborContainers.filter(c => c.neighborsForeign.length)
  
    // get border cells
    territory.borderCells = territoryCells.filter(c => {
      return c.poly.some(p => isPtInBorder(p, rangeX, rangeY))
    })
  })

  const territoriesBorderSegments = []
  const isMulti = []
  const territoriesSegments = territories.map(territory => {

    const segments = []
    const borderSegments = []

    // collect frontier segs
    territory.frontierCells.forEach(frontierCell => {
      frontierCell.neighborsForeign.map(foreignCell => {
      // console.log(frontierCell, foreignCell)
        const sharedEdges = getSharedEdgesWith(frontierCell.poly, foreignCell.poly)
        if (sharedEdges && sharedEdges.length) {
          segments.push(sharedEdges)
        }
      })
    })

    // collect border segs
    territory.borderCells.forEach(edgeCell => {
      const borderPts = [] 
      edgeCell.poly.forEach(pt => {
        const rdpt = pt
        if(rangeX[1] - rdpt[0] < .1 && rdpt[0] !== rangeX[1]) {
          console.log(rdpt)
        }
        if (isPtInBorder(pt, rangeX, rangeY)) {
          borderPts.push(pt)
        }
      })
      if (borderPts.length) {
        const uniqBorderPts = _.uniqBy(borderPts, v => v.join(','))
        borderSegments.push(uniqBorderPts)
        segments.push(uniqBorderPts)
      }
    })
    territoriesBorderSegments[territory.index] = borderSegments
    const uniqSegments = _.uniqBy(segments, v => v.join(','))

    // Now to create ordered (ie segemnts follow in order) polygons
    const polygonsOrderedSegs = []

    let firstSeg = uniqSegments.splice(0, 1)[0]
    let currentPolygonOrderedSegs = [firstSeg]
    let currentEnd = firstSeg[1]

    let cnt = 0

    while (uniqSegments.length) {
    // try to find next seg for lastOpenLine
      const nextSegFromEndIndex = uniqSegments.findIndex(seg =>
        (seg[0][0] === currentEnd[0] && seg[0][1] === currentEnd[1]) ||
      (seg[1][0] === currentEnd[0] && seg[1][1] === currentEnd[1])
      )
      if (nextSegFromEndIndex > -1) {
        const nextSeg = uniqSegments.splice(nextSegFromEndIndex, 1)[0]
        const nextSegReordered = (nextSeg[0][0] === currentEnd[0] && nextSeg[0][1] === currentEnd[1]) ? 
          [nextSeg[0], nextSeg[1]] :
          [nextSeg[1], nextSeg[0]]
        currentPolygonOrderedSegs.push(nextSegReordered)
        currentEnd = nextSegReordered[1]
      }

      if (!uniqSegments.length || (nextSegFromEndIndex === -1 && uniqSegments.length)) {
        polygonsOrderedSegs.push(currentPolygonOrderedSegs)
      }

      if (nextSegFromEndIndex === -1) {
        firstSeg = uniqSegments.splice(0, 1)[0]
        currentPolygonOrderedSegs = [firstSeg]
        currentEnd = firstSeg[1]
        isMulti.push(territory.index)
      }

      if (!uniqSegments.length) {
        break
      }

      cnt++
      if (cnt > 10000) {
        console.warn('Could not create ordered polygons, stopping to avoid crashing')
        break
      }
    }
    return polygonsOrderedSegs
  })



  const geoJSONIsland = turf.buffer((island), 0.05)
  const geoJSONPolygons = territoriesSegments.map((polygonsOrderedSegs, i) => {
    const polygons = polygonsOrderedSegs.map((polygonOrderedSegs) => {
      const pts = []
      for (let i = 0; i < polygonOrderedSegs.length; i++) {
        const segStart = polygonOrderedSegs[i][0]
        const pt = [scaleX.invert(segStart[0]), scaleY.invert(segStart[1])]
        pts.push(pt)
      }
      const lineString = turf.lineString(pts)
      const poly = turf.lineToPolygon(lineString)
      return poly
    })

    const multiPoly = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'MultiPolygon', coordinates: polygons.map(p => p.geometry.coordinates) }
    }
    // return multiPoly

    const intersectedPoly = turf.intersect(multiPoly, geoJSONIsland)
    if (!intersectedPoly) {
      throw new Error('Territory does not intersect with island')
    }
    intersectedPoly.properties.id = i
    return intersectedPoly

  })

  const polygons = geoJSONPolygons.filter(p => p !== null)
  // const geoJSON = turf.featureCollection(geoJSONPolygons.filter(p => p !== null))
  // console.log(JSON.stringify(geoJSON))

  // console.log('Segmenting done in ', performance.now() - t)
  if (isMulti.length) {
    drawPreview(cells, territoriesSegments, territoriesBorderSegments, isMulti)
    console.log('look')
  }
  return polygons
}