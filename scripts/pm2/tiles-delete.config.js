const { STORAGE_BUCKET_TILES, VERSION } = require('../constants')

module.exports = {
  apps: [
    {
      name: 'delete-vectortiles',
      script: `gsutil -m rm -r gs://${STORAGE_BUCKET_TILES}/allvector${VERSION}`,
      autorestart: false,
    },
    {
      name: 'delete-heights',
      script: `gsutil -m rm -r gs://${STORAGE_BUCKET_TILES}/heights${VERSION}`,
      autorestart: false,
    },
  ],
}
