import { createApi } from "unsplash-js"

let unsplashApi = null

// Initialize Unsplash API with access key from environment
export const initUnsplash = () => {
  if (!unsplashApi && typeof window !== "undefined") {
    const accessKey = process.env.GATSBY_UNSPLASH_ACCESS_KEY
    if (accessKey) {
      unsplashApi = createApi({
        accessKey,
      })
    }
  }
  return unsplashApi
}

// Fetch band image from Unsplash by band name
export const fetchBandImage = async (bandName) => {
  const api = initUnsplash()

  if (!api) {
    console.warn(
      "Unsplash API not initialized. Missing GATSBY_UNSPLASH_ACCESS_KEY."
    )
    return null
  }

  try {
    // Search for photos with the band name
    const result = await api.search.getPhotos({
      query: `${bandName} band music`,
      page: 1,
      perPage: 1,
      orientation: "landscape",
    })

    if (result.errors) {
      console.error("Unsplash API error:", result.errors)
      return null
    }

    // Return the first photo URL if available
    if (result.response?.results?.length > 0) {
      const photo = result.response.results[0]
      return {
        url: photo.urls.regular,
        thumb: photo.urls.thumb,
        alt: photo.alt_description || `${bandName} photo`,
        photographer: photo.user.name,
        photographerUrl: photo.user.links.html,
      }
    }

    return null
  } catch (error) {
    console.error("Error fetching band image from Unsplash:", error)
    return null
  }
}

// Helper to get image URL with fallback to Contentful
export const getBandImageUrl = (band, unsplashImage) => {
  // Prefer Unsplash image if available
  if (unsplashImage?.url) {
    return unsplashImage.url
  }

  // Fallback to Contentful image
  if (band?.image?.file?.url) {
    return band.image.file.url
  }

  // Return null if no image available
  return null
}
