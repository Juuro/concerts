import { graphql } from 'gatsby'

/**
* These so called fragments are the fields we query on each template.
* A fragment make queries a bit more reuseable, so instead of typing and
* remembering every possible field, you can just use
*   ...GhostPostFields
* for example to load all post fields into your GraphQL query.
*
* Further info 👉🏼 https://www.gatsbyjs.org/docs/graphql-reference/#fragments
*
*/

// Used for tag archive pages
export const ghostTagFields = graphql`
    fragment ContentfulConcertFields on ContentfulConcert {
      id
      date(formatString: "DD.MM.YYYY")
      band {
        name
        url
        slug
      }
      city {
        lat
        lon
      }
      club
    }
`