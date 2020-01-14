gdal_translate -of GTiff -a_ullr 47.875 -17.214 48.187 -17.361 -a_srs EPSG:4269 in/tour/conan-doyle.png out/tour/conan-doyle.tif
# gdalwarp -of GTiff -t_srs EPSG:3857 out/tour/conan-doyle.tif out/tour/conan-doyle-merc.tif
gdal_translate -of GTiff -a_ullr 23.34295 -58.1412 24.07991 -58.33037 -a_srs EPSG:4269 in/tour/mary-shelley.png out/tour/mary-shelley.tif
# gdalwarp -of GTiff -t_srs EPSG:3857 out/tour/mary-shelley.tif out/tour/mary-shelley-merc.tif
gdalbuildvrt -o out/tour/merged.vrt out/tour/mary-shelley.tif out/tour/conan-doyle.tif
gdal2tiles.py --profile=mercator -z 4-13 out/tour/merged.vrt out/tour/tiles --exclude
