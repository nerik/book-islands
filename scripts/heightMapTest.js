#!/usr/bin/env node

const hgt = require('node-hgt')
const tilebelt = require('@mapbox/tilebelt')
const _ = require('lodash')
const Jimp = require('Jimp')


// https://github.com/mapbox/rio-rgbify/blob/master/rio_rgbify/encoders.py#L4
const BASEVAL = -10000
const INTERVAL = .1 
const heightToRGB = (height) => {
  let h = height
  h -= BASEVAL
  h /= INTERVAL
  const nh = h/256
  const f = Math.floor
  const b = f(((nh) - (f(nh))) * 256)
  const g = ((f(nh) / 256) - f(f(nh)/256)) * 256
  const r = ((f(f(nh)/256) / 256) - f(f(f(nh)/256)/256)) * 256
  return { r, g, b }
}

const TILE_SIZE_PX = 512
const NUM_PX = TILE_SIZE_PX * TILE_SIZE_PX

// var tile = [115,106,8] // x,y,z
var tile = [230,213,9] // x,y,z
const tilebbox = tilebelt.tileToBBOX(tile) // [ -18.28125, 28.304380682962773, -16.875, 29.535229562948455 ]
console.log(tilebbox)

const [ lngStart, latStart, lngEnd, latEnd ] = tilebbox
const lngDelta = Math.abs(lngEnd - lngStart)
const latDelta = Math.abs(latEnd - latStart)
const lngStep = lngDelta / TILE_SIZE_PX
const latStep = latDelta / TILE_SIZE_PX
console.log([latStart, lngStart], [latEnd, lngEnd])



const instructions = []
for (let x = 0; x < TILE_SIZE_PX; x++) {
  for (let y = 0; y < TILE_SIZE_PX; y++) {
    instructions.push({
      x,
      y,
      lng: lngStart + lngStep * x,
      lat: latStart + latStep * y
    })
  }
}

// console.log(instructions)
let instrIndex = 0

var tileset = new hgt.TileSet('./out/hgt')

const getElevation = (index) => {
  const instr = instructions[index]
  // console.log('getElevation', instr)
  tileset.getElevation([instr.lat, instr.lng], function(err, elevation) {
    if (err) {
      // console.log('getElevation failed: ' + err.message)
    } else {
      // console.log(elevation)
    }
    // console.log(instrIndex)
    instrIndex++
    if (instrIndex < NUM_PX) {
      instr.elevation = (elevation === undefined) ? 0 : elevation
      getElevation(instrIndex)
    } else {
      const colors = instructions.map(i => {
        const ele = (i.elevation) ? i.elevation : 0
        const n = (i.elevation) ? Math.floor(256 * (i.elevation / 2500)) : 0
        const {r,g,b} = heightToRGB(ele)
        console.log(r,g,b)
        return Jimp.rgbaToInt(r, g, b, 255)
      })
      const toLines = _.chunk(colors, TILE_SIZE_PX)
      console.log(toLines)
      
      let image = new Jimp(TILE_SIZE_PX, TILE_SIZE_PX, function (err, image) {
        if (err) throw err
      
        toLines.forEach((row, y) => {
          row.forEach((color, x) => {
            image.setPixelColor(color, x, y)
          })
        })
      
        image.write('test.png', (err) => {
          if (err) throw err
        })
      })


    }
    
  })
}
getElevation(0)