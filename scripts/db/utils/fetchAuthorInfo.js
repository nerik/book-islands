require('dotenv').config()
const rp = require('request-promise')
const kebabCase = require('lodash/kebabCase')
const $ = require('cheerio')

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY
const GOOGLE_BOOKS_BASE_URL =
  process.env.GOOGLE_BOOKS_BASE_URL || 'https://www.google.com/books/edition/_/'

const FETCH_KNOWLEGDE_GRAPH = true
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
  try {
    const { items } = await rp({ uri, json: true })
    if (items && items.length) {
      const book = items.find((item) => item.volumeInfo.authors.includes(author))
      if (book) {
        const { canonicalVolumeLink, title } = book.volumeInfo
        const url = canonicalVolumeLink
        const html = await rp(url, { followAllRedirects: true })
        const aboutTheAuthor = $('#about_author_v', html)
        const bio = aboutTheAuthor && aboutTheAuthor.text()
        if (bio) {
          const authorInfo = {
            id: kebabCase(author),
            name: author,
            bio,
            source: 'Google Books API',
            url,
            book: { id: book.id, title },
          }
          return authorInfo
        } else {
          throw new Error(`No book author match with book api results for ${author}`)
        }
      } else {
        throw new Error(`No author data in books api result for ${author}`)
      }
    } else {
      throw new Error(`No data in books api for ${author}`)
    }
  } catch (e) {
    throw new Error(`Error requesting data in books api for ${author}`)
  }
}

async function getAuthorInfoFromKnowledgeGraph(author) {
  const apiUrl = 'https://kgsearch.googleapis.com/v1/entities:search'
  const encodedAuthor = encodeURIComponent(author)
  const uri = `${apiUrl}?query=${encodedAuthor}&key=${GOOGLE_API_KEY}&limit=3&indent=True&types=Person`
  const { itemListElement } = await rp({ uri, json: true })
  if (itemListElement && itemListElement.length) {
    const descriptions = [
      'author',
      'biograph',
      'biolog',
      'book',
      'cartograp',
      'critic',
      'correspondent',
      'editor',
      'economist',
      'explor',
      'essay',
      'geolog',
      'mathemat',
      'philosoph',
      'polymath',
      'histor',
      'journal',
      'novel',
      'playwright',
      'physicist',
      'poet',
      'Pope',
      'politic',
      'professor',
      'publish',
      'theorist',
      'theolo',
      'traged',
      'writ',
    ]
    const bestMatchIndex = itemListElement.findIndex((e) => {
      const { description, detailedDescription } = e.result
      return descriptions.some(
        (d) =>
          (description && description.includes(d)) ||
          (detailedDescription &&
            detailedDescription.articleBody &&
            detailedDescription.articleBody.includes(d))
      )
    })
    if (bestMatchIndex > -1) {
      const { name, image, detailedDescription } = itemListElement[bestMatchIndex].result
      if (detailedDescription) {
        const authorInfo = {
          source: 'Knowledge Graph',
          id: kebabCase(author),
          name,
          url: detailedDescription.url,
          ...(image && image.contentUrl && { image: image.contentUrl }),
          bio: detailedDescription && detailedDescription.articleBody,
        }
        return authorInfo
      }
    } else {
      console.log(uri)
      return null
    }
  }
}

async function getAuthorInfoFromWikipedia(author) {
  try {
    const url = `https://en.wikipedia.org/wiki/${author}`
    const html = await rp(url, { followAllRedirects: true })
    const authorInfo = {
      wikipediaUrl: url,
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
    return authorInfo
  } catch (e) {
    if (DEBUG) {
      console.log(`Error fetching author: ${author} in wikipedia: ${e.message}`)
    }
    return {}
  }
}

async function getAuthorInfoFromGoogleBookInfo(author, book) {
  const url = `${GOOGLE_BOOKS_BASE_URL}${book.id}`
  const html = await rp(url, {
    followAllRedirects: true,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36',
    },
  })
  const authorHTMLSelector = '.r0Sd2e.OxklM .Co1Hzf'
  const aboutTheAuthor = $(authorHTMLSelector, html)
  const bio = aboutTheAuthor && aboutTheAuthor.text()
  if (DEBUG) {
    console.log(`Fetching author: ${author} and book id: ${book.id}`)
  }
  if (bio) {
    const authorInfo = {
      id: kebabCase(author),
      name: author,
      bio,
      url,
      source: 'Google Books',
      book: { ...book },
    }
    return authorInfo
  } else {
    throw new Error(`No author information in the book`)
  }
}

async function getAuthorInfo(author, book) {
  if (book && book.id) {
    try {
      const authorInfo = await getAuthorInfoFromGoogleBookInfo(author, book)
      const bioUpper = authorInfo.bio && authorInfo.bio.toUpperCase()
      if (bioUpper && author.split(' ').some((name) => bioUpper.includes(name.toUpperCase()))) {
        return authorInfo
      } else if (DEBUG) {
        console.warn(
          `Data from google book author info ${author} and book ${book.id} doesn't match with author name trying with knowlegde graph`
        )
      }
    } catch (e) {
      if (DEBUG) {
        console.warn(
          `Error fetching google book info author ${author} and book ${book.id} (${e.message})`
        )
      }
      // throw new Error(`No data found in books info source`)
    }
  }

  try {
    if (FETCH_KNOWLEGDE_GRAPH) {
      try {
        const authorInfo = await getAuthorInfoFromKnowledgeGraph(author)
        if (FETCH_WIKIPEDIA_DATA && authorInfo && authorInfo.name) {
          try {
            const authorExtraInfo = getAuthorInfoFromWikipedia(authorInfo.name)
            return { ...authorInfo, ...authorExtraInfo }
          } catch (e) {
            if (DEBUG) {
              console.warn(`No wikipedia data for ${author}`)
            }
            return authorInfo
          }
        }
      } catch (e) {
        if (DEBUG) {
          console.warn(`No author info in knowledge`)
          // console.warn(e.message)
        }
      }
    }

    if (FETCH_BOOKS_API) {
      if (DEBUG) {
        console.log(`No google knowledge graph data, trying with books api data for ${author}`)
      }
      try {
        const authorInfo = await getAuthorInfoFromBooksAPI(author)
        return authorInfo
      } catch (e) {
        if (DEBUG) {
          // console.warn(e.message)
          console.warn(`No author info in books API`)
        }
      }
    }
    throw new Error(`No data found in any source`)
  } catch (e) {
    if (DEBUG) {
      console.warn(`Error fetching knowlegde graph for author ${author} (${e.message})`)
    }
    throw new Error(author)
  }
}

module.exports = getAuthorInfo
