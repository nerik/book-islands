module.exports = (bbox) => {
  const w = bbox[2] - bbox[0]
  const h = bbox[3] - bbox[1]
  const r = w/h
  return r
}