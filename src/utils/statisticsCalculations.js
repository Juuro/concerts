/**
 * Utility functions for calculating concert statistics
 */

/**
 * Calculate concerts per year
 * @param {Array} concerts - Array of concert nodes
 * @returns {Object} Object with years as keys and counts as values
 */
export const calculateYearCounts = (concerts) => {
  const yearArray = concerts
    .filter((item) => {
      if (new Date() < new Date(item.date)) {
        return false
      }
      return true
    })
    .map((item) => {
      return new Date(item.date).getFullYear().toString()
    })
    .filter((year) => year !== false)

  const yearCounts = {}
  for (const year of yearArray) {
    yearCounts[year] = yearCounts[year] ? yearCounts[year] + 1 : 1
  }
  return yearCounts
}

/**
 * Calculate concerts per city
 * @param {Array} concerts - Array of concert nodes
 * @returns {Object} Object with cities as keys and counts as values
 */
export const calculateCityCounts = (concerts) => {
  const cityArray = concerts
    .map((concert) => {
      if (new Date() < new Date(concert.date)) {
        return false
      }
      return concert.fields?.geocoderAddressFields?._normalized_city
    })
    .filter((city) => city !== false && city !== null)

  const cityCounts = {}
  for (const city of cityArray) {
    if (!city) {
      continue
    }
    cityCounts[city] = cityCounts[city] ? cityCounts[city] + 1 : 1
  }
  return cityCounts
}

/**
 * Calculate most seen bands
 * @param {Array} bands - Array of band edges
 * @returns {Array} Array of band objects sorted by concert count
 */
export const calculateMostSeenBands = (bands) => {
  return bands
    .filter((elem) => !!elem.node.concert)
    .map((elem) => {
      const concertCount = elem.node.concert.filter(
        (concert) => new Date() > new Date(concert.date)
      ).length

      return {
        id: elem.node.id,
        slug: elem.node.slug,
        name: elem.node.name,
        numberOfConcerts: concertCount,
      }
    })
    .sort((a, b) => b.numberOfConcerts - a.numberOfConcerts)
}

/**
 * Calculate concerts per location (club/venue)
 * @param {Array} concerts - Array of concert nodes
 * @returns {Object} Object with locations as keys and counts as values
 */
export const calculateLocationCounts = (concerts) => {
  const locationArray = concerts
    .map((concert) => {
      if (new Date() < new Date(concert.date)) {
        return false
      }
      return concert.club
    })
    .filter((location) => location !== false && location !== null)

  const locationCounts = {}
  for (const location of locationArray) {
    if (!location) {
      continue
    }
    locationCounts[location] = locationCounts[location]
      ? locationCounts[location] + 1
      : 1
  }
  return locationCounts
}

/**
 * Calculate festivals vs concerts count
 * @param {Array} concerts - Array of concert nodes
 * @returns {Object} Object with festival and concert counts
 */
export const calculateFestivalsVsConcerts = (concerts) => {
  const pastConcerts = concerts.filter(
    (concert) => new Date() >= new Date(concert.date)
  )

  const festivals = pastConcerts.filter((concert) => concert.isFestival).length
  const regularConcerts = pastConcerts.length - festivals

  return {
    festivals,
    concerts: regularConcerts,
    total: pastConcerts.length,
  }
}

/**
 * Calculate most visited festivals
 * @param {Array} concerts - Array of concert nodes
 * @returns {Object} Object with festival names as keys and counts as values
 */
export const calculateMostVisitedFestivals = (concerts) => {
  const festivalArray = concerts
    .filter((concert) => {
      if (new Date() < new Date(concert.date)) {
        return false
      }
      return concert.isFestival && concert.festival
    })
    .map((concert) => concert.festival.name)

  const festivalCounts = {}
  for (const festival of festivalArray) {
    if (!festival) {
      continue
    }
    festivalCounts[festival] = festivalCounts[festival]
      ? festivalCounts[festival] + 1
      : 1
  }
  return festivalCounts
}

/**
 * Calculate cost per year
 * @param {Array} concerts - Array of concert nodes
 * @returns {Object} Object with years as keys and total costs as values
 */
export const calculateCostPerYear = (concerts) => {
  const costByYear = {}

  concerts
    .filter((concert) => new Date() >= new Date(concert.date))
    .forEach((concert) => {
      if (concert.cost && concert.cost > 0) {
        const year = new Date(concert.date).getFullYear().toString()
        costByYear[year] = (costByYear[year] || 0) + concert.cost
      }
    })

  return costByYear
}

/**
 * Calculate cost per band
 * @param {Array} concerts - Array of concert nodes
 * @returns {Object} Object with band names as keys and total costs as values
 */
export const calculateCostPerBand = (concerts) => {
  const costByBand = {}

  concerts
    .filter((concert) => new Date() >= new Date(concert.date))
    .forEach((concert) => {
      if (concert.cost && concert.cost > 0) {
        concert.bands?.forEach((band) => {
          costByBand[band.name] = (costByBand[band.name] || 0) + concert.cost
        })
      }
    })

  return costByBand
}
