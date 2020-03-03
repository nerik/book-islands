const rdChan = () => Math.floor(Math.random() * 255)
const rdColArray = () => [rdChan(), rdChan(), rdChan()]

const randomColor = () => {
  const [cluster_r, cluster_g, cluster_b] = rdColArray()
  const properties = {
    cluster_r,
    cluster_g,
    cluster_b,
  }
  return properties
}

module.exports = randomColor
