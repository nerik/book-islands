const { STORAGE_BUCKET_TILES } = require('../constants')

module.exports = {
  apps: [
    {
      name: 'backup-islands',
      script: `gsutil -m mv -r gs://${STORAGE_BUCKET_TILES}/islands gs://${STORAGE_BUCKET_TILES}/islands2`,
      autorestart: false,
    },
    {
      name: 'backup-points',
      script: `gsutil -m mv -r gs://${STORAGE_BUCKET_TILES}/points gs://${STORAGE_BUCKET_TILES}/points2`,
      autorestart: false,
    },
    {
      name: 'backup-territories',
      script: `gsutil -m mv -r gs://${STORAGE_BUCKET_TILES}/territories gs://${STORAGE_BUCKET_TILES}/territories2`,
      autorestart: false,
    },
    {
      name: 'backup-heights',
      script: `gsutil -m mv -r gs://${STORAGE_BUCKET_TILES}/height gs://${STORAGE_BUCKET_TILES}/height2`,
      autorestart: false,
    },
  ],
}
