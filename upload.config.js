module.exports = {
  apps : [
    {
      name: 'upload-data',
      script: 'gsutil -m cp -r out/search-db.csv gs://cilex-books-map-data && gsutil -m cp -r out/books gs://cilex-books-map-data && gsutil -m cp -r font-glyphs gs://cilex-books-map-data && gsutil -m cp -r sprites gs://cilex-books-map-data',
      autorestart: false,
    },
    {
      name: 'upload-islands',
      script: 'gsutil -h "Cache-Control:public,max-age=1296000" -h "Content-Encoding:gzip" -m cp -r tiles/islands gs://cilex-books-map-tiles',
      autorestart: false,
    },
    {
      name: 'upload-points',
      script: 'gsutil -h "Cache-Control:public,max-age=1296000" -h "Content-Encoding:gzip" -m cp -r tiles/points gs://cilex-books-map-tiles',
      autorestart: false,
    },
    {
      name: 'upload-heights',
      script: 'gsutil -h "Cache-Control:public,max-age=1296000" -m cp -r tiles/height gs://cilex-books-map-tiles',
      autorestart: false,
    }
  ],
}
