DEPENDENCIES:
tippecanoe
https://github.com/mapbox/mbutil
QGIS

1. Books dataset cleanup steps
Fill .env with api keys
Follow: https://docs.google.com/drawings/d/1WDeQxxFDiNA2Y5J7IK4ZqCoCdBpEwG2N2rY1Je_4Yuw/edit

2. Generate the clean and definitive books database
./scripts/db/generateDb.js

3. Generate static books and author jsons
./scripts/db/generateBookJSONS.js
./scripts/db/generateAuthorJSONS.js

4. Prepare layout
./scripts/db/generateAuthors.js
./scripts/umap/normalizeToWorld.js
./scripts/layout/addClusters.js
./scripts/baseIslands/physicalToGeoJSON.js
./scripts/baseIslands/generateBaseIslands.js
./scripts/layout/score.js
./scripts/layout/layout.js
./scripts/layout/points.js
./scripts/layout/collectHighDefIslands.js
./scripts/layout/createSearchDatabase.js

./scripts/tiles/islandsTiles.js
./scripts/tiles/pointsTiles.js

./scripts/tiles/height/download.js
./scripts/tiles/height/heightTiles.js

RUN
yarn serve
yarn start