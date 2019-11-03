const getClusterTerritories = require('./getClusterTerritories')

const tryGetTerritories = (cluster, clusterChildren, island, clusterWeights) => {
  // console.log('Trying with', cluster.properties.layouted_id, cluster.properties.cluster_point_count)

  // if (cluster.properties.layouted_id !== 'cluster_Dan Brown') return

  const NUM_TRIES = 10
  let errorMsgs = []
  for (let i = 0; i < NUM_TRIES; i++) {
    try {
      const {lines, polygons} = getClusterTerritories(clusterChildren, clusterWeights, island, cluster.properties.layouted_id)
      // console.log('Success!')
      return {lines, polygons}
    } catch (e) {
      // console.log('failed: ', e.message)
      errorMsgs.push(e.message)
    }
  }
  return {error:errorMsgs}
}

module.exports = tryGetTerritories