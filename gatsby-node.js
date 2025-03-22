const Promise = require(`bluebird`)
const path = require(`path`)
const opencage = require("opencage-api-client")
/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/node-apis/
 */

// You can delete this file if you're not using it
const mockComponents = {
  "ISO_3166-1_alpha-2": "DE",
  "ISO_3166-1_alpha-3": "DEU",
  "ISO_3166-2": ["DE-BW"],
  _category: "outdoors/recreation",
  _type: "sports_centre",
  city: "Heidelberg",
  continent: "Europe",
  country: "Germany",
  country_code: "de",
  county: "Landkreis Ludwigsburg",
  political_union: "European Union",
  postcode: "71638",
  road: "Fuchshofstraße",
  sports_centre: "Stadion",
  state: "Baden-Württemberg",
  state_code: "BW",
  suburb: "Ludwigsburg - Ost",
  town: "Heidelberg",
  village: "Heidelberg",
}

exports.createPages = ({ graphql, actions }) => {
  const { createPage } = actions

  const createBands = new Promise((resolve, reject) => {
    const bandsTemplate = path.resolve(`./src/templates/band.js`)

    resolve(
      graphql(`
        {
          allContentfulBand(
            sort: { name: ASC }
            filter: { slug: { ne: "data-schema" } }
          ) {
            edges {
              node {
                slug
                url
                name
              }
            }
          }
        }
      `).then((result) => {
        if (result.errors) {
          return reject(result.errors)
        }

        if (!result.data.allContentfulBand) {
          return resolve()
        }

        const items = result.data.allContentfulBand.edges

        for (const item of items) {
          const node = item.node

          // This part here defines, that our tag pages will use
          // a `/tag/:slug/` permalink.
          node.url = `/band/${node.slug}/`

          createPage({
            path: node.url,
            component: path.resolve(bandsTemplate),
            context: {
              // Data passed to context is available
              // in page queries as GraphQL variables.
              slug: node.slug,
              name: node.name,
            },
          })
        }

        return resolve()
      })
    )
  })

  const createCityPages = new Promise((resolve, reject) => {
    const cityTemplate = path.resolve(`./src/templates/city.js`)

    resolve(
      graphql(`
        {
          allContentfulConcert {
            nodes {
              date
              fields {
                geocoderAddressFields {
                  city
                  town
                  village
                }
              }
            }
          }
        }
      `).then((result) => {
        if (result.errors) {
          return reject(result.errors)
        }

        if (!result.data.allContentfulConcert) {
          return resolve()
        }

        const items = result.data.allContentfulConcert.nodes

        const cityArray = items.map((date) => {
          switch (true) {
            case !!date.fields.geocoderAddressFields.village:
              return date.fields.geocoderAddressFields.village
            case !!date.fields.geocoderAddressFields.town:
              return date.fields.geocoderAddressFields.town
            case !!date.fields.geocoderAddressFields.city:
            default:
              return date.fields.geocoderAddressFields.city
          }
        })

        console.log("cityArray", cityArray)

        for (const city of cityArray) {
          const slug = city?.toLowerCase().replace("/s+/", "-")

          console.log("city", city)
          console.log("slug", slug)

          createPage({
            path: `/city/${slug}/`,
            component: path.resolve(cityTemplate),
            context: {
              // Data passed to context is available
              // in page queries as GraphQL variables.
              name: city,
            },
          })
        }

        return resolve()
      })
    )
  })

  const createYears = new Promise((resolve, reject) => {
    const yearsTemplate = path.resolve(`./src/templates/year.js`)

    resolve(
      graphql(`
        {
          allContentfulConcert(sort: { date: ASC }) {
            edges {
              node {
                year: date(formatString: "YYYY")
                date
              }
            }
          }
        }
      `).then((result) => {
        if (result.errors) {
          return reject(result.errors)
        }

        if (!result.data.allContentfulConcert) {
          return resolve()
        }

        const items = result.data.allContentfulConcert.edges

        // TODO: Clean this shit up.

        const moep = items
          .filter((item) => {
            if (new Date() < new Date(item.node.date)) {
              return false
            }
            return true
          })
          .map((item) => {
            return item.node.year
          })

        const unique = [...new Set(moep)]

        unique.forEach((year) => {
          const gt = `${year}-01-01`
          const lt = `${year}-12-31`

          createPage({
            path: `/year/${year}`,
            component: path.resolve(yearsTemplate),
            context: {
              // Data passed to context is available
              // in page queries as GraphQL variables.
              year,
              gt,
              lt,
            },
          })
        })

        return resolve()
      })
    )
  })

  return Promise.all([createBands, createYears, createCityPages])
}

exports.onCreateWebpackConfig = ({ stage, loaders, actions }) => {
  if (stage === "build-html" || stage === "develop-html") {
    actions.setWebpackConfig({
      module: {
        rules: [
          {
            test: /leaflet/,
            use: loaders.null(),
          },
          {
            test: /leaflet.markercluster/,
            use: loaders.null(),
          },
        ],
      },
    })
  }
}

exports.onCreateNode = async ({ node, actions: { createNodeField } }) => {
  if (node.internal.type === "ContentfulConcert") {
    const query = `${node.city.lat}, ${node.city.lon}`
    const apiRequestOptions = {
      key: process.env.OPENCAGE_API_KEY,
      q: query,
    }

    try {
      let data = await opencage.geocode(apiRequestOptions)

      if (data.status.code == 200) {
        if (data.results.length > 0) {
          var place = data.results[0]

          console.log("place", place)

          createNodeField({
            node,
            name: `geocoderAddressFields`,
            value: place.components,
            // value: mockComponents,
          })
        }
      } else {
        console.error("error", data.status.message)
      }
    } catch (error) {
      console.error("ALARM! ALARM!! 🚨", error)

      // createNodeField({
      //   node,
      //   name: `geocoderAddressFields`,
      //   value: mockComponents,
      // })
    }
  }
}
