DEPENDENCIES:
tippecanoe
https://github.com/mapbox/mbutil
QGIS

1. Books dataset cleanup steps
Fill .env with api keys
./scripts/db/generate290Db.js
./scripts/db/extractMostImportantBooks.js
Review `MOST_IMPORTANT_BOOKS_INFO_REVIEWED_CSV` and perform by hand review
./scripts/db/fillMostImportanBooksInfo.js
./scripts/db/mergeCleanedBooks.js
./scripts/db/removeDuplicatedAuthors.js

2. Generate the clean and definitive books database
./scripts/db/generateDb.js

3. Generate static books and author jsons
./scripts/db/generateBookJSONS.js
./scripts/db/generateAuthorJSONS.js

4. Prepare layout
./scripts/db/generateAuthors.js
./scripts/umap/normalizeToWorld.js
./scripts/layout/clusterByPop.js
./scripts/baseIslands/physicalToGeoJSON.js
./scripts/baseIslands/generateBaseIslands.js
./scripts/layout/score.js
./scripts/layout/layout.js
./scripts/layout/territories.js
./scripts/layout/points.js
./scripts/layout/collectHighDefIslands.js
./scripts/layout/createSearchDatabase.js

./scripts/tiles/islandsTiles.js
./scripts/tiles/pointsTiles.js
./scripts/tiles/territoriesTiles.js

./scripts/tiles/height/download.js
./scripts/tiles/height/heightTiles.js

RUN
yarn serve
yarn start