#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const _ = require('lodash')
const parse = require('csv-parse/lib/sync')
const authorSlug = require('../util/authorSlug')
const d3 = require('d3')
const turf = require('@turf/turf')
const { UMAP_CAT, UMAP_GEO, UMAP_CAT_META } = require('../constants')

const umapsMeta = JSON.parse(fs.readFileSync(UMAP_CAT_META, 'utf-8'))

const umapFeatures = Object.values(umapsMeta).flatMap(
  ({ file, bounds }) => {
    const umap = parse(
      fs.readFileSync(path.join(UMAP_CAT, `${file}.csv`), 'utf-8')
    )
    const umapAuthors = parse(
      fs.readFileSync(path.join(UMAP_CAT, `${file}_authors.csv`), 'utf-8')
    )

    const umapNormalized = umap.map((umapCoordinate, index) => {
      const [author_id, author] = umapAuthors[index]
      const [, x, y] = umapCoordinate

      return {
        x: parseFloat(x),
        y: parseFloat(y),
        author,
        author_id,
        author_slug: authorSlug({author, category: file }),
        category: file,
      }
    })

    const xMin = _.minBy(umapNormalized, 'x').x
    const xMax = _.maxBy(umapNormalized, 'x').x
    const yMin = _.minBy(umapNormalized, 'y').y
    const yMax = _.maxBy(umapNormalized, 'y').y

    const domainX = [xMin, xMax]
    const rangeX = [bounds[0], bounds[2]]
    const domainY = [yMin, yMax]
    const rangeY = [bounds[1], bounds[3]]

    const lng = d3.scaleLinear().domain(domainX).range(rangeX)
    const lat = d3.scaleLinear().domain(domainY).range(rangeY)

    const features = umapNormalized.map((record) => {
      const point = turf.point([
        lng(record.x),
        lat(record.y)
      ])
      point.properties.id = record.author
      point.properties.author_id = record.author_id
      point.properties.author_slug = record.author_slug
      point.properties.category = file
      return point
    })

    return features
  }
)

const geoJSON = {
  type: 'FeatureCollection',
  features: umapFeatures
}

fs.writeFileSync(UMAP_GEO, JSON.stringify(geoJSON))

console.log('Wrote ', geoJSON.features.length, ' features to ', UMAP_GEO)
