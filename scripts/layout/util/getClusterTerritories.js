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
  const rangeX = [1, islandW * 10000]
  const rangeY = [1, islandH * 10000]
  const totalPoints = Math.max(1000, Math.round(rangeX[1] * rangeY[1] * .005))
  console.log(totalPoints)

  const islandCoords = island.geometry.coordinates[0]

  const xMin = d3.min(islandCoords.map(p => p[0]))
  const xMax = d3.max(islandCoords.map(p => p[0]))
  const yMin = d3.min(islandCoords.map(p => p[1]))
  const yMax = d3.max(islandCoords.map(p => p[1]))

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
  
  console.log('Delaunay done in ', performance.now() - t)


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


  const territoriesSegments = territories.map(territory => {

    const segments = []

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
        if (isPtInBorder(pt, rangeX, rangeY)) {
          borderPts.push(pt)
        }
      })
      if (borderPts.length) {
        segments.push(_.uniqBy(borderPts, v => v.join(',')))
      }
    })
    const uniqSegments = _.uniqBy(segments, v => v.join(','))

    // Now to create ordered (ie segemnts follow in order) polygons
    const firstSeg = uniqSegments.splice(0, 1)[0]
    const polygonOrderedSegs = [firstSeg]
    let currentEnd = firstSeg[1]

    let cnt = 0
    while (uniqSegments.length) {
    // console.log(lastOpenLine.end)
    // try to find next seg for lastOpenLine
      const nextSegFromEndIndex = uniqSegments.findIndex(seg =>
        (seg[0][0] === currentEnd[0] && seg[0][1] === currentEnd[1]) ||
      (seg[1][0] === currentEnd[0] && seg[1][1] === currentEnd[1])
      )
      // console.log(nextSegFromEndIndex, uniqSegments.length)
      if (nextSegFromEndIndex > -1) {
        const nextSeg = uniqSegments.splice(nextSegFromEndIndex, 1)[0]
        // console.log(nextSeg)
        const nextSegReordered = (nextSeg[0][0] === currentEnd[0]) ? 
          [nextSeg[0], nextSeg[1]] :
          [nextSeg[1], nextSeg[0]]
        // console.log(nextSegReordered)
        polygonOrderedSegs.push(nextSegReordered)
        currentEnd = nextSegReordered[1]
      }

      if (nextSegFromEndIndex === -1 || !uniqSegments.length) {
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



  const geoJSONIsland = turf.buffer((island), 0.05)
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
    const intersectedPoly = turf.intersect(poly, geoJSONIsland)
    if (!intersectedPoly) {
      // console.warn('Territory does not intersect with island')
      throw new Error('Territory does not intersect with island')
    }
    intersectedPoly.properties.id = i
    return intersectedPoly
  // return JSON.stringify(turf.featureCollection([poly]))
  })

  const polygons = geoJSONPolygons.filter(p => p !== null)
  // const geoJSON = turf.featureCollection(geoJSONPolygons.filter(p => p !== null))
  // console.log(JSON.stringify(geoJSON))

  console.log('Segmenting done in ', performance.now() - t)

  return polygons
}