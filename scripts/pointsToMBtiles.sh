rm ./out/points-author.mbtiles
tippecanoe -o ./out/points-author.mbtiles --maximum-zoom=g --drop-densest-as-needed --extend-zooms-if-still-dropping ./out/points-author.geo.json

#rm ./out/points-authorbooks.mbtiles
#tippecanoe -o ./out/points-authorbooks.mbtiles --minimum-zoom=6 --maximum-zoom=10 --drop-densest-as-needed ./out/points-authorbooks.geo.json