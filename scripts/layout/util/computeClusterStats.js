const _ = require('lodash')
const avg = require('../../util/avg')

module.exports = (clusterChildren) => {
  return {
    cluster_point_count: clusterChildren.length,
    sum_popularity: _.sumBy(clusterChildren, (a) => a.properties.sum_popularity),
    avg_popularity: avg(clusterChildren.map((a) => a.properties.sum_popularity)),
    books_count: _.sumBy(clusterChildren, (a) => a.properties.books_count),
    children: clusterChildren.map((p) => p.properties.layouted_id),
  }
}
