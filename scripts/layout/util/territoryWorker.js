const workerpool = require('workerpool')
const turf = require('@turf/turf')
const getClusterTerritories = require('./getClusterTerritories')
const transposeAndScale = require('../../util/transposeAndScale')

const getTerritories = (cluster, clusterChildren, islandMrct, scale) => {
  const clusterCenterMrct = turf.toMercator(cluster)
  const islandMrctTransposed = transposeAndScale(clusterCenterMrct, islandMrct, scale)
  const island = turf.toWgs84(islandMrctTransposed)

  // TODO for now just generate "dirty" territories ovelapping islands
  // will then have to generate "borders"
  // TODO generate real weights
  const clusterWeights = clusterChildren.map(p => 1)
  const NUM_TRIES = 1
  for (let i = 0; i < NUM_TRIES; i++) {
    try {
      const {lines, polygons} = getClusterTerritories(clusterChildren, clusterWeights, island)
      return {lines, polygons}
    } catch (e) {
      // console.log(e.message)
      // console.log('failed')
    }
  }
}

workerpool.worker({
  getTerritories
})