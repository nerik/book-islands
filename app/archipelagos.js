/* global d3 */

var margin = {top: 10, right: 30, bottom: 30, left: 60},
  width = 1800 - margin.left - margin.right,
  height = 900 - margin.top - margin.bottom

const MIN_LNG = -180
const MAX_LNG = 180
const MIN_LAT = -80
const MAX_LAT = 80

var svg = d3.select('#canvas')
  .append('svg')
  .attr('width', width + margin.left + margin.right)
  .attr('height', height + margin.top + margin.bottom)
  .append('g')
  .attr('transform',
    'translate(' + margin.left + ',' + margin.top + ')')

d3.json('../out/umap/umap_cat_stats.json').then(umapCats => {
  d3.json('../scripts/umap/archipelagos_meta.json').then(archipelagosMeta => {
    console.log(umapCats, archipelagosMeta)

    const x = d3.scaleLinear()
      .domain([MIN_LNG, MAX_LNG])
      .range([ 0, width ])

    svg.append('g')
      .attr('transform', 'translate(0,' + height + ')')
      .call(d3.axisBottom(x))

    const y = d3.scaleLinear()
      .domain([MIN_LAT, MAX_LAT])
      .range([height, 0])

    svg.append('g')
      .call(d3.axisLeft(y))

    umapCats.forEach(umapCat => {
      console.log(umapCat.name)
      let trans = {
        scale: [1, 1],
        translate: [0, 0]
      }

      if (archipelagosMeta[umapCat.name]) {
        const archTrans = archipelagosMeta[umapCat.name]
        trans = archTrans
      }
      const scaledTrans = [x(trans.translate[0] + MIN_LNG), y(trans.translate[1] - MIN_LAT)]

      const umapCatG = svg.append('g')
        .attr('id', 'clusters')
        .attr('transform', `translate(${scaledTrans[0]}, ${scaledTrans[1]}) scale(${trans.scale[0]}, ${trans.scale[1]})`)
        .attr('transform-origin', `${width/2} ${height/2}`)

      umapCatG.append('text')
        .text(`${umapCat.name} ${umapCat.count}`)
        .attr('x', width/2)
        .attr('y', height/2)
        .attr('text-anchor', 'middle')
        .attr('fill', umapCat.color)
        .attr('font-size', '30px')
        .attr('font-family', 'sans-serif')


      umapCatG.selectAll('dot')
        .data(umapCat.clusters)
        .enter()
        .append('circle')
        .attr('cx', (d) => x(d.geometry.coordinates[0]))
        .attr('cy', (d) => y(d.geometry.coordinates[1]))
        .attr('r', (d) => {
          return Math.max(5, d.properties.point_count/10)
        })
        .style('fill', umapCat.color)
        .style('fill-opacity', .6)
        .style('stroke-opacity', .6)
    })

  })
})
