module.exports = (authorObject) => {
  const numBooksMult = 1 + (authorObject.books_count - 1) * 0.5
  const popMult = 1 + authorObject.sum_popularity * 0.000015
  const layoutPriorityScore = popMult * numBooksMult
  return layoutPriorityScore
}
