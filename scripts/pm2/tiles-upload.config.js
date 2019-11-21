const { STORAGE_BUCKET_TILES, VERSION } = require('../constants')
// TODO add a high cache value, removed for testing for now
const cacheAge = 1296000

module.exports = {
  apps: [
    {
      name: 'upload-islands',
      script: `gsutil -h "Cache-Control:public,max-age=${cacheAge}" -h "Content-Encoding:gzip" -m cp -r tiles/islands/* gs://${STORAGE_BUCKET_TILES}/islands${VERSION}`,
      autorestart: false,
    },
    {
      name: 'upload-points',
      script: `gsutil -h "Cache-Control:public,max-age=${cacheAge}" -h "Content-Encoding:gzip" -m cp -r tiles/points/* gs://${STORAGE_BUCKET_TILES}/points${VERSION}`,
      autorestart: false,
    },
    {
      name: 'upload-territories',
      script: `gsutil -h "Cache-Control:public,max-age=${cacheAge}" -h "Content-Encoding:gzip" -m cp -r tiles/territories/* gs://${STORAGE_BUCKET_TILES}/territories${VERSION}`,
      autorestart: false,
    },
    {
      name: 'upload-heights',
      script: `gsutil -h "Cache-Control:public,max-age=${cacheAge}" -m cp -r tiles/height/* gs://${STORAGE_BUCKET_TILES}/heights${VERSION}`,
      autorestart: false,
    },
  ],
}
