const { STORAGE_BUCKET_TILES, VERSION } = require('../constants')

module.exports = {
  apps: [
    {
      name: 'delete-islands',
      script: `gsutil -m rm -r gs://${STORAGE_BUCKET_TILES}/islands${VERSION}`,
      autorestart: false,
    },
    {
      name: 'delete-points',
      script: `gsutil -m rm -r gs://${STORAGE_BUCKET_TILES}/points${VERSION}`,
      autorestart: false,
    },
    {
      name: 'delete-territories',
      script: `gsutil -m rm -r gs://${STORAGE_BUCKET_TILES}/territories${VERSION}`,
      autorestart: false,
    },
    {
      name: 'delete-heights',
      script: `gsutil -m rm -r gs://${STORAGE_BUCKET_TILES}/height${VERSION}`,
      autorestart: false,
    },
  ],
}
