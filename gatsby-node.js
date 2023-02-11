const _ = require(`lodash`)
const Promise = require(`bluebird`)
const path = require(`path`)
const opencage = require("opencage-api-client")
/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/node-apis/
 */

// You can delete this file if you're not using it

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
                name
                url
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

        _.forEach(items, ({ node }) => {
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
              url: node.url,
            },
          })
        })

        return resolve()
      })
    )
  })

  return Promise.all([createBands])
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
    console.log("onCreateNode", node.city)

    const query = `${node.city.lat}, ${node.city.lon}`
    const apiRequestOptions = {
      key: "d00c9c8449954f00a217e544dcd4df70",
      q: query,
    }

    try {
      let data = await opencage.geocode(apiRequestOptions)

      if (data.status.code == 200) {
        if (data.results.length > 0) {
          var place = data.results[0]

          createNodeField({
            node,
            name: `geocoderAddressFields`,
            value: place.components,
          })
        }
      } else {
        console.error("error", data.status.message)
      }
    } catch (error) {
      console.log("ALARM! ALARM!! 🚨", error)
    }
  }
}
