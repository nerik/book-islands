#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const os = require('os')
const _ = require('lodash')
const request = require('request')
const { performance } = require('perf_hooks')
const { getTileCoordinates } = require('./renderTile')
const progressBar = require('../../util/progressBar')
const { getBboxTiles, downloadFile, unZip } = require('./utils')
const { TEST_BBOX, HGT_DATA } = require('../../constants')

const linksPath = `${HGT_DATA}/download-links.json`
const cachePath = `${HGT_DATA}/download-links-cache.json`

const downloadLinksCache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf-8')) : {}
function getDownloadLinks({ lat, lng }) {
  return new Promise(function(resolve, reject) {
    const key = `${lat}-${lng}`
    if (downloadLinksCache[key]) {
      resolve(downloadLinksCache[key])
    }
    request(
      `http://www.imagico.de/map/dem_json.php?date=&lon=${lng}&lat=${lat}&lonE=${lng}&latE=${lat}&vf=1`,
      function(err, response, body) {
        if (!err && response.statusCode === 200) {
          try {
            var data = JSON.parse(body)
            const links = data.map((d) => ({ name: d.name, link: d.link }))
            downloadLinksCache[key] = links
            fs.writeFileSync(cachePath, JSON.stringify(downloadLinksCache))
            resolve(links)
          } catch (e) {
            reject('Could not parse response from imagico: ' + body)
          }
        } else {
          reject(err || response)
        }
      }
    )
  })
}

async function generateDownloadLinks (tile) {
  const tileCoordinates = getTileCoordinates(tile)

  const tileCoordinatesLatLng = _.uniqWith(
    tileCoordinates
      .filter(({ lat, lng }) => lat && lng)
      // .map(({ lat, lng }) => ({ lat, lng, key: converSNWE({ lat, lng }) })),
      .map(({ lat, lng }) => ({ lat: Math.round(lat), lng: Math.round(lng) })),
    _.isEqual
  )
  const links = []
  for (let i = 0; i < tileCoordinatesLatLng.length; i++) {
    const tile = tileCoordinatesLatLng[i]
    try {
      const link = await getDownloadLinks(tile)
      links.push(link)
    } catch(e) {
      console.log('Failed generating link', e)
    }
  }

  return _.uniqBy(_.flatMap(links), 'link')
}

async function downloadAndUnzip(link) {
  try {
    const tempPath = path.join(os.tmpdir(), link.name)
    await downloadFile(link.link, tempPath)
    try {
      await unZip(tempPath, HGT_DATA)
    } catch(e) {
      console.log('Error unziping file', e)
      return false
    }
    fs.unlinkSync(tempPath)
    return true
  } catch(e) {
    console.log('Error downloading file', e)
    return false
  }
}

let downloadLinks = []
async function prepareOfflineTiles(tiles) {
  const hasLinksReady = fs.existsSync(linksPath)
  if (!hasLinksReady) {
    console.log('Preparing links to download')
    const pb = progressBar(tiles.length)
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i]
      const links = await generateDownloadLinks(tile)
      downloadLinks =  downloadLinks.concat(links)
      pb.increment()
    }
    downloadLinks = downloadLinks.map(l => ({ ...l, downloaded: false }))
    fs.writeFileSync(linksPath, JSON.stringify(downloadLinks))
    console.log(`File links to download generated in ${linksPath}`)
    pb.stop()
  } else {
    downloadLinks = JSON.parse(fs.readFileSync(linksPath, 'utf-8'))
  }

  console.log('Downloading data')
  const linksToDownload = downloadLinks.filter(l => !l.downloaded)
  const pb = progressBar(linksToDownload.length)
  for (let i = 0; i < linksToDownload.length; i++) {
    const link = linksToDownload[i]
    const downloaded = await downloadAndUnzip(link)
    if (downloaded) {
      link.downloaded = downloaded
      fs.writeFileSync(linksPath, JSON.stringify(downloadLinks))
    }
    pb.increment()
  }
  console.log('\n')
  console.log(`Data ready in ${HGT_DATA} path`)
  pb.stop()
}

const BBOX = [TEST_BBOX.minX, TEST_BBOX.minY, TEST_BBOX.maxX, TEST_BBOX.maxY]
async function prepareOffline(zooms = [8, 9]) {
  const tt = performance.now()
  for (let i = 0; i < zooms.length; i++) {
    const zoom = zooms[i]
    console.log('Starting zoom level', zoom)
    const t = performance.now()
    const tiles = getBboxTiles(BBOX, zoom)
    await prepareOfflineTiles(tiles)

    console.log(`${zoom} done in ${(performance.now() - t) / 1000}s`)
  }
  console.log(`Total time downloading ${(performance.now() - tt) / 1000}`)
  process.exit()
}

prepareOffline()

// module.exports = {
//   prepareOffline: prepareOffline
// }
