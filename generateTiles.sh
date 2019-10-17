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

scp /Users/joseangel/Workspace/book-islands/scripts/tiles/height/produceTiles.js j8seangel@35.204.229.243:/home/j8seangel/book-islands/in
