/* global d3, Supercluster */

var margin = {top: 10, right: 30, bottom: 30, left: 60},
  width = 2000 - margin.left - margin.right,
  height = 1200 - margin.top - margin.bottom

var svg = d3.select('#canvas')
  .append('svg')
  .attr('width', width + margin.left + margin.right)
  .attr('height', height + margin.top + margin.bottom)
  .append('g')
  .attr('transform',
    'translate(' + margin.left + ',' + margin.top + ')')

document.getElementById('controls').addEventListener('mousedown', e => {
  if (e.target.id === 'check-points') {
    console.log(e.target.checked)
    document.getElementById('points').style.visibility = (!e.target.checked) ? 'visible' : 'hidden'
  }
  if (e.target.id === 'check-clusters') {
    console.log(e.target.checked)
    document.getElementById('clusters').style.visibility = (!e.target.checked) ? 'visible' : 'hidden'
  }
})

var url = new URL(window.location)
var umap = url.searchParams.get('umap') || 'UMAP_with_author'

d3.csv(`../in/umap/${umap}.csv`)
  .then(data => {
    let features = data.map(p => {
      const feature = {
        'type': 'Feature',
        'properties': {
          id: p.id
        },
        'geometry': {
          'type': 'Point',
          'coordinates': [
            +p.x,
            +p.y
          ]
        }
      }
      return feature
    })

    const minX = d3.min(features, d => d.geometry.coordinates[0])
    const maxX = d3.max(features, d => d.geometry.coordinates[0])
    const minY = d3.min(features, d => d.geometry.coordinates[1])
    const maxY = d3.max(features, d => d.geometry.coordinates[1])

    // clusters
    const index = new Supercluster({
      radius: 2,
      maxZoom: 16
    })
    index.load(features)
    let clusters = index.getClusters([minX, minY, maxX, maxY], 2)

    clusters = clusters.map(cluster => {
      if (!cluster.properties.cluster_id) return cluster
      return {
        ...cluster,
        leaves: index.getLeaves(cluster.properties.cluster_id, Infinity).map(l => l.properties.id)
      }
    })

    // features = features.map(feature => {
    //   const cluster = clusters.find(cluster => {
    //     if (cluster.leaves === undefined) {
    //       return undefined
    //     }
    //     return cluster.leaves.find(l => l === feature.properties.id)
    //   })
    //   return {
    //     ...feature,
    //     properties: {
    //       ...feature.properties,
    //       clusterId: (cluster) ? cluster.id : undefined,
    //     }
    //   }
    // })

    console.log(features)
    console.log('Num clusters:', clusters.length)
    console.log(clusters)

    const x = d3.scaleLinear()
      .domain([minX, maxX])
      .range([ 0, width ])
  
    svg.append('g')
      .attr('transform', 'translate(0,' + height + ')')
      .call(d3.axisBottom(x))

    const y = d3.scaleLinear()
      .domain([minY, maxY])
      .range([0, height])

    svg.append('g')
      .call(d3.axisLeft(y))


    // const colors = {}
    // const getColor = (id) => {
    //   if (id === undefined) return '#ff0000'
    //   if (colors[id]) {
    //     return colors[id]
    //   }
    //   const rd = () => Math.floor(Math.random() * 255)
    //   colors[id] = `rgb(${rd()}, ${rd()}, ${rd()})`
    //   return colors[id]
    // }
    svg.append('g')
      .attr('id', 'points')
      .selectAll('dot')
      .data(features)
      .enter()
      .append('circle')
      .attr('cx', (d) => x(d.geometry.coordinates[0]))
      .attr('cy', (d) => y(d.geometry.coordinates[1]))
      .attr('r', .5)
      // .style('fill', d => getColor(d.properties.clusterId))
      .style('fill-opacity', 1)

    svg.append('g')
      .attr('id', 'clusters')
      .selectAll('dot')
      .data(clusters)
      .enter()
      .append('circle')
      .attr('cx', (d) => x(d.geometry.coordinates[0]))
      .attr('cy', (d) => y(d.geometry.coordinates[1]))
      .attr('r', (d) => {
        if (d.properties.point_count === undefined) {
          return 2
        }
        return Math.max(2, d.properties.point_count/100)
      })
      .style('fill', d => (d.properties.point_count === undefined) ? '#ff0000' : '#fa5412')
      .style('stroke', d => (d.properties.point_count === undefined) ? '#ff0000' : '#fa5412')
      .style('fill-opacity', .3)
      .style('stroke-opacity', .6)
      .on('mouseenter', d => {
        // console.log(d)
        document.getElementById('info').innerText = d.properties.point_count
      })
      .on('click', d => {
        const leaves = index.getLeaves(d.properties.cluster_id, Infinity)
        console.log(leaves)
        console.log(leaves.map(d => d.properties.id))

      })

    
  })