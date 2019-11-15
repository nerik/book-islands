/* global d3, Supercluster, turf, _ */

var margin = { top: 10, right: 30, bottom: 30, left: 60 },
  width = 2000 - margin.left - margin.right,
  height = 1200 - margin.top - margin.bottom

var svg = d3
  .select('#canvas')
  .append('svg')
  .attr('width', width + margin.left + margin.right)
  .attr('height', height + margin.top + margin.bottom)
  .append('g')
  .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')

document.getElementById('controls').addEventListener('mousedown', (e) => {
  if (e.target.id === 'check-points') {
    console.log(e.target.checked)
    document.getElementById('points').style.visibility = !e.target.checked ? 'visible' : 'hidden'
  }
  if (e.target.id === 'check-clusters') {
    console.log(e.target.checked)
    document.getElementById('clusters').style.visibility = !e.target.checked ? 'visible' : 'hidden'
  }
})

var url = new URL(window.location)
var umap = url.searchParams.get('umap') || 'UMAP_with_author'

const getClustersSupercluster = (features, bbox) => {
  const initialIndex = new Supercluster({
    radius: 0.05,
    maxZoom: 18,
  })
  initialIndex.load(features)
  const initialClustersWithNoise = initialIndex.getClusters(bbox, 2)
  const initialClusters = initialClustersWithNoise
    .filter((c) => c.properties.cluster_id)
    .map((cluster) => {
      const initialClusterId = cluster.properties.cluster_id
      if (initialClusterId === undefined) {
        return {
          ...cluster,
          initialLeaves: [],
          properties: {
            ...cluster.properties,
          },
        }
      }
      return {
        ...cluster,
        initialLeaves: initialIndex
          .getLeaves(cluster.properties.cluster_id, Infinity)
          .map((l) => l.properties.id),
        properties: {
          initialClusterId: cluster.properties.cluster_id,
          cluster_id: undefined,
        },
      }
    })

  console.log('Initial pass: generated ', initialClusters.length, ' clusters')
  console.log(
    'Initial pass: ',
    initialClustersWithNoise.length - initialClusters.length,
    ' points left alone'
  )
  console.log(
    'Initial pass mean pts per cluster: ',
    d3.mean(initialClusters.map((c) => c.initialLeaves.length))
  )

  const metaIndex = new Supercluster({
    radius: 0.08,
    maxZoom: 18,
  })
  metaIndex.load(initialClusters)
  const metaClustersWithNoise = metaIndex.getClusters(bbox, 2)
  // const metaClustersWithoutAllLeafClusters = metaClustersWithNoise.filter(metaCluster => {
  //   const metaClusterId = metaCluster.properties.cluster_id
  //   if (metaClusterId === undefined) {
  //     const initialClusterId = metaCluster.properties.initialClusterId
  //     // case where cluster failed at both level
  //     if (initialClusterId === undefined) {
  //       return false
  //     }
  //     return true
  //   }
  //   const allInitialLeaves = metaIndex.getLeaves(metaClusterId, Infinity)
  //     .filter(l => l.initialLeaves.length)
  //   return allInitialLeaves.length

  // })
  const metaClusters = metaClustersWithNoise.map((metaCluster) => {
    const metaClusterId = metaCluster.properties.cluster_id
    if (metaClusterId === undefined) {
      const initialClusterId = metaCluster.properties.initialClusterId
      if (initialClusterId === undefined) {
        console.log('standalone point in metacluster standalone point')
        return {
          leaves: [],
        }
      }
      return {
        cluster_id: initialClusterId,
        leaves: initialClusters.find((c) => c.properties.initialClusterId === initialClusterId)
          .initialLeaves,
      }
    }
    const allInitialLeaves = metaIndex.getLeaves(metaClusterId, Infinity).map((metaLeaf) => {
      const initialClusterId = metaLeaf.properties.initialClusterId
      if (initialClusterId === undefined) {
        return [metaLeaf.properties.id]
      }
      const firstCluster = initialClusters.find(
        (c) => c.properties.initialClusterId === initialClusterId
      )
      return firstCluster.initialLeaves
    })
    return {
      cluster_id: metaClusterId,
      leaves: _.flatten(allInitialLeaves),
    }
  })
  console.log(
    'Meta pass: generated ',
    metaClusters.length,
    ' clusters + ',
    initialClustersWithNoise.length - initialClusters.length,
    ' standalone pts'
  )
  console.log(
    'First pass mean pts per cluster: ',
    d3.mean(metaClusters.map((c) => c.leaves.length))
  )

  const featuresDict = {}
  features.forEach((feature) => {
    featuresDict[feature.properties.id] = feature
  })

  metaClusters.forEach((cluster) => {
    if (cluster.leaves) {
      cluster.leaves.forEach((leaf) => {
        const id = leaf
        featuresDict[id].properties.cluster_id = cluster.cluster_id
      })
    }
  })

  const clusterPoints = Object.keys(featuresDict).map((id) => {
    const feature = featuresDict[id]
    return feature
  })

  return clusterPoints
}

const getClustersDbscan = (features) => {
  console.log(features.length, 'features')
  const t = performance.now()
  const clusteredFeatures = turf.clustersDbscan(turf.featureCollection(features.slice(0, 10000)), 6)
  console.log('done in', performance.now() - t)
  const noise = clusteredFeatures.features.filter((p) => p.properties.dbscan === 'noise')
  console.log('noise:', noise.length)
  return clusteredFeatures.features.map((f) => {
    return {
      ...f,
      properties: {
        ...f.properties,
        cluster_id: f.properties.cluster,
      },
    }
  })
}

const getClusters = (features) => {
  const clustersDict = {}
  features.forEach((f) => {
    if (f.properties.cluster_id) {
      if (!clustersDict[f.properties.cluster_id]) {
        clustersDict[f.properties.cluster_id] = {
          point_count: 0,
          children: [],
        }
      }
      clustersDict[f.properties.cluster_id].point_count++
      clustersDict[f.properties.cluster_id].children.push(f.properties.id)
    }
  })
  const clusters = Object.keys(clustersDict).map((id) => {
    const feature = clustersDict[id]
    return feature
  })
  return clusters
}

d3.csv(`../in/umap/${umap}.csv`).then((data) => {
  let features = data.map((p) => {
    const feature = {
      type: 'Feature',
      properties: {
        id: p.id,
      },
      geometry: {
        type: 'Point',
        coordinates: [+p.x, +p.y],
      },
    }
    return feature
  })

  const minX = d3.min(features, (d) => d.geometry.coordinates[0])
  const maxX = d3.max(features, (d) => d.geometry.coordinates[0])
  const minY = d3.min(features, (d) => d.geometry.coordinates[1])
  const maxY = d3.max(features, (d) => d.geometry.coordinates[1])

  // clusters
  const bbox = [minX, minY, maxX, maxY]
  console.log(bbox)
  const clusteredFeatures = getClustersSupercluster(
    features,
    // features.slice(0, 9999),
    bbox
  )
  // const clusteredFeatures = getClustersDbscan(features)
  console.log(clusteredFeatures)
  const clusters = getClusters(clusteredFeatures)
  console.log(clusters)
  console.log(d3.mean(clusters.map((c) => c.point_count)))

  const x = d3
    .scaleLinear()
    .domain([minX, maxX])
    // .domain([5.3, 6.3])
    .range([0, width])

  svg
    .append('g')
    .attr('transform', 'translate(0,' + height + ')')
    .call(d3.axisBottom(x))

  const y = d3
    .scaleLinear()
    .domain([minY, maxY])
    // .domain([-1, 1])
    .range([0, height])

  svg.append('g').call(d3.axisLeft(y))

  const colors = {}
  const getColor = (id) => {
    if (id === undefined) return '#aaa'
    if (colors[id]) {
      return colors[id]
    }
    const rd = () => Math.floor(Math.random() * 255)
    colors[id] = `rgb(${rd()}, ${rd()}, ${rd()})`
    return colors[id]
  }
  svg
    .append('g')
    .attr('id', 'points')
    .selectAll('dot')
    .data(clusteredFeatures)
    .enter()
    .append('circle')
    .attr('cx', (d) => x(d.geometry.coordinates[0]))
    .attr('cy', (d) => y(d.geometry.coordinates[1]))
    .attr('r', (d) => (d.properties.cluster_id ? 1.5 : 1))
    .style('fill', (d) => getColor(d.properties.cluster_id))
    .style('fill-opacity', (d) => (d.properties.cluster_id ? 1 : 1))

  // svg.append('g')
  //   .attr('id', 'clusters')
  //   .selectAll('dot')
  //   .data(clusters)
  //   .enter()
  //   .append('circle')
  //   .attr('cx', (d) => x(d.geometry.coordinates[0]))
  //   .attr('cy', (d) => y(d.geometry.coordinates[1]))
  //   .attr('r', (d) => {
  //     if (d.properties.point_count === undefined) {
  //       return 2
  //     }
  //     return Math.max(2, d.properties.point_count/100)
  //   })
  //   .style('fill', d => (d.properties.point_count === undefined) ? '#ff0000' : '#fa5412')
  //   .style('stroke', d => (d.properties.point_count === undefined) ? '#ff0000' : '#fa5412')
  //   .style('fill-opacity', .3)
  //   .style('stroke-opacity', .6)
  //   .on('mouseenter', d => {
  //     // console.log(d)
  //     document.getElementById('info').innerText = d.properties.point_count
  //   })
  //   .on('click', d => {
  //     // const leaves = index.getLeaves(d.properties.cluster_id, Infinity)
  //     // console.log(leaves)
  //     // console.log(leaves.map(d => d.properties.id))

  //   })
})
