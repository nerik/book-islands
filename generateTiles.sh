./scripts/db/generateAuthors.js \
&& ./scripts/umap/normalizeToWorld.js \
&& ./scripts/layout/cluster.js \
&& ./scripts/baseIslands/generateBaseIslands.js \
&& ./scripts/baseIslands/physicalToGeoJSON.js \
&& ./scripts/layout/score.js \
&& ./scripts/layout/layout.js \
&& ./scripts/layout/layoutInner.js \
&& ./scripts/layout/collectHighDefIslands.js \
&& ./scripts/layout/createSearchDatabase.js \

./scripts/tiles/islandsTiles.js \
&& ./scripts/tiles/pointTiles.js
