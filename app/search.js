/* global mapboxgl, d3 */

mapboxgl.accessToken =
  'pk.eyJ1Ijoic2F0ZWxsaXRlc3R1ZGlvLW5lcmlrIiwiYSI6ImNrMDNxcnQwaTJocWkzZHE5dTZ3NjJmeGUifQ.eAUQbcE9Qdbq5jYxskIE3A'
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/satellitestudio-nerik/ck0c6asof40yz1dmvjwuhm48b',
  center: [0, 0],
  zoom: 3,
  hash: true,
})

const search = document.getElementById('search')

const sanitize = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

d3.csv('./search-db.csv').then((data) => {
  console.log(data)
  search.style.visibility = 'visible'
  search.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      console.log(search.value)
      const result = data.filter(
        (a) => sanitize(a.author).toLowerCase() === sanitize(search.value).toLowerCase()
      )
      console.log(result)
      if (result.length) {
        search.style.border = '3px solid green'
        map.flyTo({
          center: [parseFloat(result[0].lng), parseFloat(result[0].lat)],
          zoom: 7,
        })
      } else {
        search.style.border = '3px solid red'
      }
    }
  })
})
