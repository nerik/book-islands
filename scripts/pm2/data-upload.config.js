const { STORAGE_BUCKET_DATA } = require('../constants')

module.exports = {
  apps: [
    {
      name: 'set-cors',
      script: `gsutil cors set bucket-cors.json gs://${STORAGE_BUCKET_DATA}`,
      autorestart: false,
    },
    {
      name: 'upload-data',
      script: `gsutil -m cp -r out/search-db gs://${STORAGE_BUCKET_DATA} && gsutil -m cp -r out/authors gs://${STORAGE_BUCKET_DATA} && gsutil -m cp -r out/books gs://${STORAGE_BUCKET_DATA} && gsutil -m cp -r font-glyphs gs://${STORAGE_BUCKET_DATA} && gsutil -m cp -r sprite gs://${STORAGE_BUCKET_DATA} && gsutil -m cp -r tour gs://${STORAGE_BUCKET_DATA}`,
      autorestart: false,
    },
  ],
}
