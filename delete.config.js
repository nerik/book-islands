const bucket = 'cilex-books-map-data'
const tilesBucket = 'cilex-books-map-tiles'

module.exports = {
  apps : [
    {
      name: 'delete-books',
      script: `gsutil -m rm -r gs://${bucket}/books`,
      autorestart: false,
    },
    {
      name: 'delete-islands',
      script: `gsutil -m rm -r gs://${tilesBucket}/islands`,
      autorestart: false,
    },
    {
      name: 'delete-points',
      script: `gsutil -m rm -r gs://${tilesBucket}/points`,
      autorestart: false,
    },
    {
      name: 'delete-territories',
      script: `gsutil -m rm -r gs://${tilesBucket}/territories`,
      autorestart: false,
    },
    {
      name: 'delete-heights',
      script: `gsutil -m rm -r gs://${tilesBucket}/height`,
      autorestart: false,
    },
  ],
}
