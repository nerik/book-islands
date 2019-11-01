const { STORAGE_BUCKET_TILES } = require('../constants')

module.exports = {
  apps : [
    {
      name: 'delete-islands',
      script: `gsutil -m rm -r gs://${STORAGE_BUCKET_TILES}/islands`,
      autorestart: false,
    },
    {
      name: 'delete-points',
      script: `gsutil -m rm -r gs://${STORAGE_BUCKET_TILES}/points`,
      autorestart: false,
    },
    {
      name: 'delete-territories',
      script: `gsutil -m rm -r gs://${STORAGE_BUCKET_TILES}/territories`,
      autorestart: false,
    },
    {
      name: 'delete-heights',
      script: `gsutil -m rm -r gs://${STORAGE_BUCKET_TILES}/height`,
      autorestart: false,
    },
  ],
}
