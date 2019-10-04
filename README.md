DEPENDENCIES:
tippecanoe
https://github.com/mapbox/mbutil
QGIS


SCRIPTS
./scripts/db/generateAuthors.js
./scripts/umap/normalizeToWorld.js
./scripts/layout/cluster.js
./scripts/baseIslands/physicalToGeoJSON.js
./scripts/baseIslands/generateBaseIslands.js
./scripts/layout/score.js
./scripts/layout/layout.js
./scripts/tiles/islandsTiles.js

RUN
yarn serve
yarn start