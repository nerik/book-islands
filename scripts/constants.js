const d3 = require('d3')
module.exports = {
  BOOKS_CSV: 'in/google-books/books.csv',
  BOOKS_290K_CSV: 'in/google-books/books_290k.csv',
  BOOKS_WITHOUT_DUPLICATES_CSV: 'in/google-books/books-without-duplicates.csv',
  BOOKS_MI_SCORE: 100000,
  BOOKS_MI_MERGED_CSV: 'in/google-books/most-important-books-merged.csv', // MI = Most Important
  BOOKS_MI_MERGED_NO_DUPLICATES_CSV:
    'in/google-books/most-important-books-merged-no-duplicates.csv', // MI = Most Important
  BOOKS_CLEANED_CSV: 'in/google-books/books-cleaned.csv', // USE THIS FOR EVERYTHING
  BOOKS_CLEANED_BY_CATEGORY_FOLDER: 'in/google-books/books-by-category',
  MOST_IMPORTANT_BOOKS_CSV: 'in/google-books/most-important-books.csv',
  MOST_IMPORTANT_BOOKS_INFO_CSV: 'in/google-books/most-important-books-info.csv',
  MOST_IMPORTANT_BOOKS_INFO_REVIEWED_CSV: 'in/google-books/most-important-books-info-reviewed.csv',
  MOST_IMPORTANT_BOOKS_INFO_REVIEWED_FILLED_CSV:
    'in/google-books/most-important-books-info-reviewed-filled.csv',
  MOST_IMPORTANT_BOOKS_INFO_REVIEWED_FILLED_NO_DUPLICATES_CSV:
    'in/google-books/most-important-books-info-reviewed-filled-no-duplicates.csv',
  BOOKS_DB_290K: 'in/google-books/books_290K.db',
  BOOKS_DB: 'in/google-books/books.db',
  BOOKS_DB_TABLE: 'books',
  AUTHORS: 'out/db/authors.json',
  BOOKS_JSON: 'out/books',
  AUTHORS_JSON: 'out/authors',
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
  POINTS: 'out/layout/authors_points.geo.json',
  POINTS_WITH_SCORE: 'out/layout/authors_points_with_score.geo.json',
  LAYOUTED_CLUSTERS: 'out/layout/layouted_clusters.geo.json',
  BASE_ISLANDS_META: 'out/layout/baseIslands.meta.json',
  ISLANDS: 'out/layout/islands.geo.json',
  ISLANDS_BBOX: 'out/layout/islands_bbox.geo.json',
  ISLANDS_LOWDEF: 'out/layout/islands_lowdef.geo.json',
  ISLANDS_LOWDEF_BUFF: 'out/layout/islands_lowdef_buff.geo.json',
  ISLANDS_CANDIDATES_META: 'out/layout/islands_candidates.meta.json',
  ISLANDS_FINAL_META: 'out/layout/islands_final.meta.json',
  ISLAND_LABELS: 'out/layout/island_labels.geo.json',
  BOOKS_POINTS: 'out/layout/books_points.geo.json',
  SEARCH_DB: 'out/search-db/search-authors-all.csv',
  SEARCH_DB_RANKED: 'out/search-db/search-authors.csv',
  SEARCH_BOOKS_DB: 'out/search-db/search-books-all.csv',
  SEARCH_BOOKS_DB_RANKED: 'out/search-db/search-books.csv',
  SEARCH_DB_BOOKS_RANKED_LIMIT: 4000,
  SEARCH_DB_AUTHORS_RANKED_LIMIT: 1000,
  MAX_ZOOM_GENERATED: 14,
  HEIGHT_TILES: 'tiles/height',
  ALL_VECTOR_TILES: 'tiles/allvector',
  HEIGHT_TILE_SIZE: 256,
  // TEST_BBOX: {
  //   minX: 3,
  //   minY: 11,
  //   maxX: 26,
  //   maxY: 23,
  // },
  TEST_BBOX: {
    minX: -180,
    minY: -90,
    maxX: 180,
    maxY: 90,
  },
  BBOX_CHUNKS: [
    // [-180, -90, 180, 90]
    // -240 and 220 it is due the umap offsets
    [-240, -80, -90, 0],
    [-90, -80, 0, 0],
    [0, -80, 90, 0],
    [90, -80, 220, 0],
    [-240, 0, -90, 80],
    [-90, 0, 0, 80],
    [0, 0, 90, 80],
    [90, 0, 220, 80],
  ],
  MAX_BASE_ISLAND_SCALE_UP: 1,
  ISLAND_RANK_SCALE: d3
    .scaleThreshold()
    .domain([0, 1, 350, 20000])
    .range([1, 1, 2, 3, 4]),
  CITIES_RANK_SCALE: d3
    .scaleThreshold()
    .domain([0, 1, 350, 7000])
    .range([1, 1, 2, 3, 4]),
  USE_PROGRESS_BAR: true,
  STORAGE_BUCKET_DATA: 'cilex-books-map-data',
  STORAGE_BUCKET_TILES: 'cilex-books-map-tiles',
  VERSION: '-v4',
}
