const { STORAGE_BUCKET_DATA } = require('../constants')

module.exports = {
  apps : [
    {
      name: 'delete-data',
      script: `gsutil -m rm -r gs://${STORAGE_BUCKET_DATA}/search-db.csv && gsutil -m rm -r gs://${STORAGE_BUCKET_DATA}/books && gsutil -m rm -r gs://${STORAGE_BUCKET_DATA}/font-glyphs && gsutil -m rm -r gs://${STORAGE_BUCKET_DATA}/sprite && gsutil -m rm -r gs://${STORAGE_BUCKET_DATA}/tour`,
      autorestart: false,
    }
  ],
}
