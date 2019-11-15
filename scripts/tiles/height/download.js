#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const os = require('os')
const turf = require('@turf/turf')
const _ = require('lodash')
const { performance } = require('perf_hooks')
const progressBar = require('../../util/progressBar')
const { downloadFile, unZip, converSNWE } = require('./utils')
const { HGT_DATA, BASE_ISLANDS } = require('../../constants')

const linksPath = `${HGT_DATA}/download-links.json`

const baseIslands = JSON.parse(fs.readFileSync(BASE_ISLANDS, 'utf-8'))
const baseIslandsBboxs = baseIslands.features.map((feature) => ({
  id: feature.properties.island_id,
  bbox: turf.bbox(feature),
}))

if (!fs.existsSync(HGT_DATA)) {
  fs.mkdirSync(HGT_DATA)
}
const baseUrl = 'http://rmd.neoknet.com/srtm3'
function getDownloadLinks(bbox) {
  const [minX, minY, maxX, maxY] = bbox
  const startX = Math.floor(minX)
  const endX = Math.floor(maxX) + 1
  const startY = Math.floor(minY)
  const endY = Math.floor(maxY) + 1
  const links = []
  for (let lat = startY; lat < endY; lat++) {
    for (let lng = startX; lng < endX; lng++) {
      const coordinates = converSNWE({ lat, lng })
      links.push({ name: coordinates, link: `${baseUrl}/${coordinates}.hgt.zip` })
    }
  }
  return links
}

async function downloadAndUnzip(link) {
  try {
    const tempPath = path.join(os.tmpdir(), link.name)
    await downloadFile(link.link, tempPath)
    try {
      await unZip(tempPath, HGT_DATA)
    } catch (e) {
      console.log('Error unziping file', e)
      return false
    }
    fs.unlinkSync(tempPath)
    return true
  } catch (e) {
    if (e.toJSON) {
      const errorCode = e.toJSON().statusCode
      console.log(`Error downloading file ${link.name}`, errorCode)
    }
    return false
  }
}

let downloadLinks = []
async function prepareOffline(islandsBbox = baseIslandsBboxs) {
  const tt = performance.now()
  const hasLinksReady = fs.existsSync(linksPath)
  console.log('Preparing links to download')
  for (let i = 0; i < islandsBbox.length; i++) {
    const island = islandsBbox[i]
    const links = getDownloadLinks(island.bbox)
    downloadLinks = downloadLinks.concat(links)
  }
  const prevDownloadLinks = hasLinksReady ? JSON.parse(fs.readFileSync(linksPath, 'utf-8')) : []
  downloadLinks = _.uniqBy(downloadLinks, 'link')
  downloadLinks = downloadLinks.map((l) => {
    const prevLink = prevDownloadLinks.find((prevL) => prevL.link === l.link)
    const downloaded = prevLink !== undefined && prevLink.downloaded
    return { ...l, downloaded }
  })
  fs.writeFileSync(linksPath, JSON.stringify(downloadLinks))
  console.log(`File links to download generated in ${linksPath}`)

  console.log('Downloading data')
  const linksToDownload = downloadLinks.filter((l) => !l.downloaded)
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
  console.log(`Total time downloading ${Math.floor(performance.now() - tt) / 1000} s`)
  pb.stop()
  process.exit()
}

prepareOffline()

// module.exports = {
//   prepareOffline: prepareOffline
// }
