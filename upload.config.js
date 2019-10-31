const cacheAge = 1296000
const bucket = 'cilex-books-map-data'
const tilesBucket = 'cilex-books-map-tiles'

module.exports = {
  apps : [
    {
      name: 'set-cors',
      script: `gsutil cors set bucket-cors.json gs://${bucket}`,
      autorestart: false,
    },
    {
      name: 'upload-data',
      script: `gsutil -m cp -r out/search-db/search-db.csv gs://${bucket} && gsutil -m cp -r out/books gs://${bucket} && gsutil -m cp -r font-glyphs gs://${bucket} && gsutil -m cp -r sprite gs://${bucket} && gsutil -m cp -r tour gs://${bucket}`,
      autorestart: false,
    },
    {
      name: 'upload-islands',
      script: `gsutil -m mv -r gs://${tilesBucket}/islands gs://${tilesBucket}/islands2 && gsutil -h "Cache-Control:public,max-age=${cacheAge}" -h "Content-Encoding:gzip" -m cp -r tiles/islands gs://${tilesBucket}`,
      autorestart: false,
    },
    {
      name: 'upload-points',
      script: `gsutil -m mv -r gs://${tilesBucket}/points gs://${tilesBucket}/points2 && gsutil -h "Cache-Control:public,max-age=${cacheAge}" -h "Content-Encoding:gzip" -m cp -r tiles/points gs://${tilesBucket}`,
      autorestart: false,
    },
    {
      name: 'upload-territories',
      script: `gsutil -m mv -r gs://${tilesBucket}/territories gs://${tilesBucket}/territories2 && gsutil -h "Cache-Control:public,max-age=${cacheAge}" -h "Content-Encoding:gzip" -m cp -r tiles/territories gs://${tilesBucket}`,
      autorestart: false,
    },
    {
      name: 'upload-heights',
      script: `gsutil -m mv -r gs://${tilesBucket}/height gs://${tilesBucket}/height2 && gsutil -h "Cache-Control:public,max-age=${cacheAge}" -m cp -r tiles/height gs://${tilesBucket}`,
      autorestart: false,
    }
  ],
}
