#!/usr/bin/env node
const fs = require('fs')
const _ = require('lodash')
const d3 = require('d3')
const turf = require('@turf/turf')
const cliProgress = require('cli-progress')
const parse = require('csv-parse/lib/sync')

// const TYPE = 'book'
const TYPE = 'author'

const OUT_PATH = `./out/points-${TYPE}.geo.json`
const OUT_AUTHORBOOKS_PATH = './out/points-authorbooks.geo.json'
const UMAP_PATH = (TYPE === 'book') ? './in/umap/UMAP_with_ids.csv' : './in/umap/UMAP_with_author.csv'

const authors = require('../out/authors.json')
const titles = require('../out/titles.json')

// TODO have globally accessible consts
const MIN_LNG = -180
const MAX_LNG = 180
const MIN_LAT = -80
const MAX_LAT = 80

const umap = parse(fs.readFileSync(UMAP_PATH, 'utf-8'), {columns: true })
umap.forEach(r => {
  r.x = parseFloat(r.x)
  r.y = parseFloat(r.y)
})

console.log('CSV read')

const xMin = _.minBy(umap, r => r.x).x
const xMax = _.maxBy(umap, r => r.x).x
const yMin = _.minBy(umap, r => r.y).y
const yMax = _.maxBy(umap, r => r.y).y
console.log('Amplitude calculated')

var lng = d3.scaleLinear().domain([xMin, xMax]).range([MIN_LNG, MAX_LNG])
var lat = d3.scaleLinear().domain([yMin, yMax]).range([MIN_LAT, MAX_LAT])


const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
progressBar.start(umap.length, 0)

const authorBooksFeatures = []
const features = umap.map(record => {
  const point = turf.point([lng(record.x), lat(record.y)])
  point.properties.type = TYPE
  point.properties.id = record.id

  if (TYPE === 'book') {
    point.properties.name = titles[record.id][0]
    point.properties.popularity = titles[record.id][1]
  } else {
    const author = authors.find(a => a.author === record.id)
    if (author) {

      point.properties.popularity_avg = author.popularity
      point.properties.popularity_avg_count_mult = author.popularity * author.books_count

      let angle = 0
      author.titles.split('|').forEach(title => {
        // console.log(title)
        // console.log(angle)
        const titlePoint = turf.transformTranslate(point, 1, angle)
        titlePoint.properties.type = 'book'
        titlePoint.properties.name = title
        angle += 360 / author.books_count
        authorBooksFeatures.push(titlePoint)
      })
    } else {
      console.log('cant find author', record.id, 'in db')
    }
  }
  progressBar.increment()
  return point
})
progressBar.stop()

fs.writeFileSync(OUT_PATH, JSON.stringify(turf.featureCollection(features)))

if (TYPE === 'author') {
  fs.writeFileSync(OUT_AUTHORBOOKS_PATH, JSON.stringify(turf.featureCollection(authorBooksFeatures)))
}