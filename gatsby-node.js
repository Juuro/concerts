const _ = require(`lodash`)
const Promise = require(`bluebird`)
const path = require(`path`)
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
            sort: { order: ASC, fields: name }
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
      `).then(result => {
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
