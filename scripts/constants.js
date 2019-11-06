const d3 = require('d3')
module.exports = {
  BOOKS_CSV: 'in/google-books/books.csv',
  BOOKS_DB: 'in/google-books/books.db',
  BOOKS_DB_TABLE: 'books',
  AUTHORS: 'out/db/authors.json',
  BOOKS_JSON: 'out/books',
  GEONAMES_DB: './out/baseIslands/geonames.db',
  SHORELINES: 'out/baseIslands/gshhs/shorelines.geo.json',
  BASE_ISLANDS: 'out/baseIslands/baseIslands.geo.json',
  BASE_ISLANDS_BBOX: 'out/baseIslands/baseIslands_bbox.json',
  BASE_ISLANDS_LOWDEF: 'out/baseIslands/baseIslands_lowdef.geo.json',
  BASE_ISLANDS_LOWDEF_MRCT: 'out/baseIslands/baseIslands_lowdef_mrct.geo.json',
  ISLETS: 'out/baseIslands/islets.geo.json',
  GEONAMES_POP_PLACES: 'out/baseIslands/populated_places.csv',
  CITIES_REAL: 'out/baseIslands/cities.geo.json',
  CITIES_STATS: 'out/baseIslands/cities_stats.json',
  HGT_DATA: 'in/hgt',
  UMAP_CAT: 'in/umap/cat',
  UMAP_CAT_META: 'scripts/umap/archipelagos_meta.json',
  UMAP_CAT_STATS: 'out/umap/umap_cat_stats.json',
  UMAP_GEO: 'out/umap/umap.geo.json',
  CLUSTERS: 'out/layout/clusters.geo.json',
  LAYOUTED_CLUSTERS: 'out/layout/layouted_clusters.geo.json',
  BASE_ISLANDS_META: 'out/layout/baseIslands.meta.json',
  ISLANDS: 'out/layout/islands.geo.json',
  ISLANDS_LOWDEF: 'out/layout/islands_lowdef.geo.json',
  ISLANDS_CANDIDATES_META: 'out/layout/islands_candidates.meta.json',
  ISLANDS_FINAL_META: 'out/layout/islands_final.meta.json',
  TERRITORY_LINES: 'out/layout/territory_lines.geo.json',
  TERRITORY_POLYGONS: 'out/layout/territory_polygons.geo.json',
  TERRITORY_LABELS: 'out/layout/territory_labels.geo.json',
  BOOKS_POINTS: 'out/layout/books_points.geo.json',
  SEARCH_DB: 'out/search-db/search-db-all.csv',
  SEARCH_DB_RANKED: 'out/search-db/search-db.csv',
  SEARCH_DB_RANKED_LIMIT: 10000,
  ISLANDS_TILES: 'tiles/islands',
  TERRITORIES_TILES: 'tiles/territories',
  MAX_ZOOM_GENERATED: 16,
  POINTS_TILES: 'tiles/points',
  HEIGHT_TILES: 'tiles/height',
  HEIGHT_TILE_SIZE: 256,
  HEIGHT_EMPTY_TILE: 'scripts/tiles/height/blank.png',
  TEST_BBOX: {
    minX: -10,
    minY: -52,
    maxX: 0,
    maxY: -42
  },
  // TEST_BBOX: {
  //   minX: -180,
  //   minY: -80,
  //   maxX: 180,
  //   maxY: 80
  // },
  BBOX_CHUNKS:[
    // -240 and 220 it is due the umap offsets
    [-240, -80, -90, 0],
    [-90 , -80, 0  , 0],
    [0   , -80, 90 , 0],
    [90  , -80, 220, 0],
    [-240, 0, -90, 80],
    [-90 , 0, 0  , 80],
    [0   , 0, 90 , 80],
    [90  , 0, 220, 80],
  ],
  MAX_BASE_ISLAND_SCALE_UP: 2,
  CITIES_RANK_SCALE: d3.scaleThreshold()
    .domain([0, 1, 200, 6000])
    .range([1,1,2,3,4]),
  TERRITORIES_RANK_SCALE: d3.scaleThreshold()
    .domain([0, 1, 200, 6000])
    .range([1,1,2,3,4]),
  USE_PROGRESS_BAR: false,
  STORAGE_BUCKET_DATA: 'cilex-books-map-data',
  STORAGE_BUCKET_TILES: 'cilex-books-map-tiles',
}
