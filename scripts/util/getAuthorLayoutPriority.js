module.exports = (authorObject) => {
  const numBooksMult = 1 + authorObject.books_count * 0.5
  const popMult = 1 + authorObject.sum_popularity * 0.00001
  const layoutPriorityScore = popMult * numBooksMult
  return layoutPriorityScore
}
