
const fs = require('fs')
const path = require('path')
const request = require('request')
const yauzl = require('yauzl')
const util = require('util')
const turf = require('@turf/turf')
const cover = require('@mapbox/tile-cover')

function zeroPad (v, l) {
  let r = v.toString()
  while (r.length < l) {
    r = '0' + r
  }
  return r
}

function converSNWE ({ lat, lng }) {
  return util.format(
    '%s%s%s%s',
    lat < 0 ? 'S' : 'N',
    zeroPad(Math.abs(Math.floor(lat)), 2),
    lng < 0 ? 'W' : 'E',
    zeroPad(Math.abs(Math.floor(lng)), 3)
  )
}

function bboxOverlaps(tileBbox, islandBbox) {
  const [tileMinX, tileMinY, tileMaxX, tileMaxY] = tileBbox
  const [islandMinX, islandMinY, islandMaxX, islandMaxY] = islandBbox

  if (islandMinX > tileMaxX || islandMaxX < tileMinX) return false
  if (islandMinY > tileMaxY || islandMaxY < tileMinY) return false
  return true
}

// https://github.com/mapbox/rio-rgbify/blob/master/rio_rgbify/encoders.py#L4
function heightToRGB(height, baseval = -10000, interval = 0.1) {
  let h = height
  h -= baseval
  h /= interval
  const nh = h / 256
  const f = Math.floor
  const r = (f(f(nh) / 256) / 256 - f(f(f(nh) / 256) / 256)) * 256
  const g = (f(nh) / 256 - f(f(nh) / 256)) * 256
  const b = f((nh - f(nh)) * 256)
  return { r, g, b }
}


function getBboxTiles(bbox, zoomLevel) {
  const limits = { min_zoom: zoomLevel, max_zoom: zoomLevel }
  const geom = turf.bboxPolygon(bbox).geometry
  return cover.tiles(geom, limits)
}

function downloadFile(url, tempPath) {
  const stream = fs.createWriteStream(tempPath)
  return new Promise(function(resolve, reject) {
    request(url, function(err, response) {
      if (!err && response.statusCode === 200) {
        resolve(stream)
      } else {
        reject(err || response)
      }
    }).pipe(stream)
  })
}

function unZip(zipPath, targetPath) {
  return new Promise(function(resolve, reject) {
    var unzips = []

    yauzl.open(zipPath, function(err, zipfile) {
      if (err) {
        reject(err)
        return
      }
      zipfile.on('entry', function(entry) {
        if (/\/$/.test(entry.fileName)) {
          return
        }
        zipfile.openReadStream(entry, function(err, readStream) {
          var lastSlashIdx = entry.fileName.lastIndexOf('/'),
            fileName = entry.fileName.substr(lastSlashIdx + 1),
            filePath = path.join(targetPath, fileName)
          if (err) {
            reject(err)
            return
          }

          unzips.push(
            new Promise(function(resolve, reject) {
              readStream.on('end', resolve)
              readStream.on('error', reject)
            })
          )
          readStream.pipe(fs.createWriteStream(filePath))
        })
      })
      zipfile.on('end', function() {
        Promise.all(unzips)
          .then(function() {
            resolve()
          })
          .catch(reject)
      })
    })
  })
}

module.exports = {
  converSNWE,
  heightToRGB,
  getBboxTiles,
  bboxOverlaps,
  downloadFile,
  unZip: unZip
}
