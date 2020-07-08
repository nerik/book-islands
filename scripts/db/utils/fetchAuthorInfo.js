require('dotenv').config()
const rp = require('request-promise')
const $ = require('cheerio')

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY
const GOOGLE_BOOKS_BASE_URL =
  process.env.GOOGLE_BOOKS_BASE_URL || 'https://www.google.com/books/edition/_/'

const FETCH_KNOWLEGDE_GRAPH = false
const FETCH_WIKIPEDIA_DATA = true
const FETCH_BOOKS_API = true
const DEBUG = true

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

async function getAuthorInfoFromBooksAPI(author) {
  const apiUrl = 'https://www.googleapis.com/books/v1/volumes'
  const encodedAuthor = encodeURIComponent(author)
  const uri = `${apiUrl}?q=+inauthor:${encodedAuthor}&key=${GOOGLE_API_KEY}`
  const { items } = await rp({ uri, json: true })
  if (items && items.length) {
    const book = items.find((item) => item.volumeInfo.authors.includes(author))
    if (book) {
      const { volumeInfo } = book
      const url = volumeInfo.canonicalVolumeLink
      const html = await rp(url, { followAllRedirects: true })
      const aboutTheAuthor = $('#about_author_v', html)
      const bio = aboutTheAuthor && aboutTheAuthor.text()
      if (bio) {
        const authorInfo = {
          id: author,
          name: author,
          bio,
          source: 'Google Books API',
          url,
        }
        return authorInfo
      } else {
        throw new Error(`No book author match with book api results`)
      }
    } else {
      throw new Error(`No author data in books api result`)
    }
  } else {
    throw new Error(`No data in books api`)
  }
}

async function getAuthorInfoFromKnowledgeGraph(author) {
  const apiUrl = 'https://kgsearch.googleapis.com/v1/entities:search'
  const encodedAuthor = encodeURIComponent(author)
  const uri = `${apiUrl}?query=${encodedAuthor}&key=${GOOGLE_API_KEY}&limit=1&indent=True&types=Person`
  const { itemListElement } = await rp({ uri, json: true })
  if (itemListElement && itemListElement.length) {
    const { name, image, url, detailedDescription } = itemListElement[0].result
    const authorInfo = {
      source: 'Knowledge Graph',
      id: author,
      name,
      url,
      ...(image && image.contentUrl && { image: image.contentUrl }),
      bio: detailedDescription && detailedDescription.articleBody,
    }
    return authorInfo
  }
}

async function getAuthorInfoFromWikipedia(author) {
  const url = `https://en.wikipedia.org/wiki/${author}`
  const html = await rp(url, { followAllRedirects: true })
  const authorInfo = {
    source: 'Wikipedia',
    url,
  }
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
}

async function getAuthorInfoFromGoogleBookInfo(author, bookId) {
  const url = `${GOOGLE_BOOKS_BASE_URL}${bookId}`
  const html = await rp(url, {
    followAllRedirects: true,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
    },
  })
  const authorHTMLSelector = '.Co1Hzf'
  const aboutTheAuthor = $(authorHTMLSelector, html)
  const bio = aboutTheAuthor && aboutTheAuthor.text()
  if (bio) {
    const authorInfo = {
      id: author,
      name: author,
      bio,
      source: 'Google Books',
      url,
    }
    return authorInfo
  } else {
    throw new Error(`No author information in the book`)
  }
}

async function getAuthorInfo(author, bookId) {
  if (bookId) {
    try {
      const authorInfo = await getAuthorInfoFromGoogleBookInfo(author, bookId)
      return authorInfo
    } catch (e) {
      if (DEBUG) {
        console.warn(
          `Error fetching google book info author ${author} and book ${bookId} (${e.message})`
        )
      }
      throw new Error(author)
    }
  } else {
    try {
      if (FETCH_KNOWLEGDE_GRAPH) {
        if (DEBUG) {
          console.log(`Fecthing knowledge graph data for ${author}`)
        }
        let authorInfo = await getAuthorInfoFromKnowledgeGraph(author)
        if (FETCH_WIKIPEDIA_DATA && authorInfo && authorInfo.name) {
          try {
            const authorExtraInfo = getAuthorInfoFromWikipedia(authorInfo.name)
            authorInfo = { ...authorInfo, ...authorExtraInfo }
          } catch (e) {
            if (DEBUG) {
              console.warn(`No wikipedia data for ${author}`)
            }
          }
        }
        return authorInfo
      } else {
        if (FETCH_BOOKS_API) {
          if (DEBUG) {
            console.warn(`No knowlegde graph data for ${author}, trying with google books api`)
          }
          try {
            const authorInfo = await getAuthorInfoFromBooksAPI(author)
            return authorInfo
          } catch (e) {
            throw new Error(e.message)
          }
        } else {
          throw new Error(`No knowlegde graph data`)
        }
      }
    } catch (e) {
      if (DEBUG) {
        console.warn(`Error fetching knowlegde graph for author ${author} (${e.message})`)
      }
      throw new Error(author)
    }
  }
}

module.exports = getAuthorInfo
