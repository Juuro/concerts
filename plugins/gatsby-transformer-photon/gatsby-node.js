const fetch = require('node-fetch')


async function onCreateNode({ node, actions }) {
  const {createNodeField} = actions
  
  if (node.internal.type !== `ContentfulConcert`) {
    return
  }
  
  let lat = undefined
  let lon = undefined
  
  console.log(node.internal.type)
  
  for (const field in node) {
    if (node[field].lat && node[field].lon) {
      lat = node[field].lat
      lon = node[field].lon
      console.log('lat, lon: ', node[field].lat, node[field].lon)
    }
  }

  try {
    let cityName = undefined
    const response = await fetch(`https://photon.komoot.de/reverse?lon=${lon}&lat=${lat}&lang=de&limit=1`)
    
    if (await response.ok) {
      const {features: [{properties: {city}}]} = await response.json()
      cityName = city
    }
    else {
      throw new Error('Kapottt')
    }
    
    console.log('cityName: ', cityName)

    createNodeField({
      node,
      name: `cityName`,
      value: cityName
    })
  }
  catch (error) {
    console.error('error', error)
  }
}
exports.onCreateNode = onCreateNode