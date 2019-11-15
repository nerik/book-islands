module.exports = ({ author, category }) => {
  if (!author || !category) {
    throw new Error('Author or category not found when generating author slug')
  }
  return `${author}|${category}`
}
