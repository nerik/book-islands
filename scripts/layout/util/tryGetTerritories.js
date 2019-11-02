const getClusterTerritories = require('./getClusterTerritories')

const tryGetTerritories = (cluster, clusterChildren, island, clusterWeights) => {
  console.log('Trying with', cluster.properties.layouted_id, cluster.properties.cluster_point_count)

  const NUM_TRIES = 1
  for (let i = 0; i < NUM_TRIES; i++) {
    try {
      const {lines, polygons} = getClusterTerritories(clusterChildren, clusterWeights, island)
      console.log('Success!')
      return {lines, polygons}
    } catch (e) {
      console.log(e.message)
      console.log('failed')
    }
  }
}

module.exports = tryGetTerritories