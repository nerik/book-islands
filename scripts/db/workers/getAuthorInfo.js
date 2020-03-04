const workerpool = require('workerpool')
const rp = require('request-promise')
const $ = require('cheerio')

const FETCH_WIKIPEDIA_DATA = true

function cleanText(text) {
  if (!text) return ''
  const removeCharactersRegex = /\[.*?\]|\(.*?\)/g
  const insertSpaceBetweenMayRegex = /[^- a-z][A-Z]/g
  return text
    .replace(/\n/g, ' ')
    .replace(removeCharactersRegex, ' ')
    .replace(insertSpaceBetweenMayRegex, (text) => `${text[0]} ${text[1]}`)
    .replace(/ {2}/g, ' ')
    .trim()
}

async function getAuthorInfo(author) {
  const uri = `https://kgsearch.googleapis.com/v1/entities:search?query=${author}&key=AIzaSyC0bsRnDv-jx6ca4lMwmL2bLyIribLAtds&limit=1&indent=True&types=Person`
  try {
    const { itemListElement } = await rp({ uri, json: true })
    const { name, image, url, detailedDescription } = itemListElement[0].result
    const authorInfo = {
      id: author,
      name,
      url,
      ...(image && image.contentUrl && { image: image.contentUrl }),
      bio: detailedDescription && detailedDescription.articleBody,
    }
    if (FETCH_WIKIPEDIA_DATA && name) {
      try {
        const url = `https://en.wikipedia.org/wiki/${name}`
        const html = await rp(url, { followAllRedirects: true })
        const tableRows = $('.infobox.vcard', html)
          .find('tbody > tr')
          .toArray()
          .filter((tr) => tr.firstChild.attribs.scope === 'row')
        const bornRow = tableRows.length
          ? tableRows.find((row) =>
              $(row, html)
                .children()
                .first()
                .text()
                .toUpperCase()
                .includes('BORN')
            )
          : null
        if (bornRow) {
          const bornText = cleanText($(bornRow.lastChild, html).text())
          if (bornText) {
            authorInfo.born = bornText
          }
        }
        const deathRow = tableRows.length
          ? tableRows.find((row) =>
              $(row, html)
                .children()
                .first()
                .text()
                .toUpperCase()
                .includes('DIED')
            )
          : null
        if (deathRow) {
          const deathText = cleanText($(deathRow.lastChild, html).text())
          if (deathText) {
            authorInfo.death = deathText
          }
        }
      } catch {
        console.warn(`Error fetching in wikipedia for ${author}`)
        throw new Error(author)
      }
    }
    return authorInfo
  } catch {
    console.warn(`Error fetching knolegde graph for author ${author}`)
    throw new Error(author)
  }
}

workerpool.worker({
  getAuthorInfo: getAuthorInfo,
})
