DEPENDENCIES:
tippecanoe
https://github.com/mapbox/mbutil
QGIS

GENERATE DB
./scripts/db/extractMostImportantBooks.js
Review `MOST_IMPORTANT_BOOKS_INFO_CSV` and perform by hand review
./scripts/db/mergeCleanedBooks.js
./scripts/db/generateDb.js


SCRIPTS
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