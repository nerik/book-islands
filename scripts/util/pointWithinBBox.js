module.exports = (point, bbox) => {
  const [lng, lat] = point.geometry ? point.geometry.coordinates : point
  const [minX, minY, maxX, maxY] = bbox
  if (lng < minX) return false
  if (lng > maxX) return false
  if (lat < minY) return false
  if (lat > maxY) return false
  return true
}
