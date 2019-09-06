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



d3.csv('../in/UMAP_with_ids.csv')
  .then(data => {
    const features = data.map(p => {
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

    svg.append('g')
      .attr('id', 'points')
      .selectAll('dot')
      .data(features)
      .enter()
      .append('circle')
      .attr('cx', (d) => x(d.geometry.coordinates[0]))
      .attr('cy', (d) => y(d.geometry.coordinates[1]))
      .attr('r', .5)
      .style('fill', '#69b3a2')
      .style('fill-opacity', .5)

    // clusters
    const index = new Supercluster({
      radius: 2,
      maxZoom: 16
    })
    index.load(features)
    const clusters = index.getClusters([minX, minY, maxX, maxY], 2)
    console.log('Num clusters:', clusters.length)

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
      .style('fill-opacity', .3)
      .style('stroke-opacity', .6)
      .style('stroke', d => (d.properties.point_count === undefined) ? '#ff0000' : '#fa5412')
      .on('mouseenter', d => {
        // console.log(d)
        document.getElementById('info').innerText = d.properties.point_count
      })
      .on('click', d => {
        const leaves = index.getLeaves(d.properties.cluster_id, 100)
        console.log(leaves)
        console.log(leaves.map(d => d.properties.id))

      })

    
  })