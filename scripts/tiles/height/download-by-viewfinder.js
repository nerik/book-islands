#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const os = require('os')
const turf = require('@turf/turf')
const _ = require('lodash')
const request = require('request')
const { performance } = require('perf_hooks')
const progressBar = require('../../util/progressBar')
const { downloadFile, unZip } = require('./utils')
const { HGT_DATA, BASE_ISLANDS } = require('../../constants')

const linksPath = `${HGT_DATA}/download-links.json`
const cachePath = `${HGT_DATA}/download-links-cache.json`

const baseIslands = JSON.parse(fs.readFileSync(BASE_ISLANDS, 'utf-8'))
const baseIslandsBboxs = baseIslands.features.map((feature) => ({
  id: feature.properties.island_id,
  bbox: turf.bbox(feature),
}))

if (!fs.existsSync(HGT_DATA)) {
  fs.mkdirSync(HGT_DATA)
}
const downloadLinksCache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf-8')) : {}
function getDownloadLinks(bbox) {
  return new Promise(function(resolve, reject) {
    const [minX, minY, maxX, maxY] = bbox
    const key = bbox.toString()
    if (downloadLinksCache[key]) {
      resolve(downloadLinksCache[key])
    }
    request(
      `http://www.imagico.de/map/dem_json.php?date=&lon=${minX}&lat=${minY}&lonE=${maxX}&latE=${maxY}&vf=1`,
      function(err, response, body) {
        if (!err && response.statusCode === 200) {
          try {
            var data = JSON.parse(body)
            const links = data.map((d) => ({ name: d.name, link: d.link }))
            downloadLinksCache[key] = links
            fs.writeFileSync(cachePath, JSON.stringify(downloadLinksCache))
            resolve(links)
          } catch (e) {
            reject('Could not parse response from imagico: ' + e)
            console.count('links generation failed')
          }
        } else {
          reject(err || response)
        }
      }
    )
  })
}

async function generateDownloadLinks (bbox) {
  try {
    const links = await getDownloadLinks(bbox)
    return _.uniqBy(_.flatMap(links), 'link')
  } catch(e) {
    console.log('Failed generating link', e)
  }
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
async function prepareOffline(islandsBbox = baseIslandsBboxs) {
  const tt = performance.now()
  const hasLinksReady = fs.existsSync(linksPath)
  if (!hasLinksReady) {
    console.log('Preparing links to download')
    const pb = progressBar(islandsBbox.length)
    for (let i = 0; i < islandsBbox.length; i++) {
      const t = performance.now()
      const island = islandsBbox[i]
      const links = await generateDownloadLinks(island.bbox)
      downloadLinks =  downloadLinks.concat(links)
      console.log(`${island.id} done in ${(performance.now() - t)} ms`)
      pb.increment()
    }
    downloadLinks = _.uniqBy(downloadLinks, 'link')
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
  console.log(`Total time downloading ${Math.floor((performance.now() - tt)) / 1000} s`)
  pb.stop()
  process.exit()
}

prepareOffline()

// module.exports = {
//   prepareOffline: prepareOffline
// }
