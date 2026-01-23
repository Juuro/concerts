/**
 * Utility module for interacting with Last.fm API
 */

let lastfmClient = null;
let LastFmNode = null;

/**
 * Initialize Last.fm API client
 */
const initLastfm = async () => {
  if (!lastfmClient && process.env.LASTFM_API_KEY) {
    // Dynamic import to avoid issues with Next.js bundling
    if (!LastFmNode) {
      const lastfm = await import('lastfm');
      LastFmNode = lastfm.default.LastFmNode;
    }
    
    lastfmClient = new LastFmNode({
      api_key: process.env.LASTFM_API_KEY,
      secret: process.env.LASTFM_SECRET || "",
    });
  }
  return lastfmClient;
};

/**
 * Fetch artist information from Last.fm
 * @param {string} artistName - Name of the artist/band
 * @returns {Promise<object|null>} Artist info including image URLs and tags/genres
 */
export const getArtistInfo = async (artistName) => {
  return new Promise(async (resolve) => {
    const lfm = await initLastfm();

    if (!lfm) {
      console.warn("Last.fm API key not configured, skipping artist info fetch");
      resolve(null);
      return;
    }

    const request = lfm.request("artist.getInfo", {
      artist: artistName,
      autocorrect: 1,
    });

    request.on("success", (data) => {
      if (!data || !data.artist) {
        console.warn(`No Last.fm data found for ${artistName}`);
        resolve(null);
        return;
      }

      const artist = data.artist;

      // Extract image URLs - Last.fm returns images in different sizes
      const images = artist.image || [];
      const imageUrls = {
        small: images.find((img) => img.size === "small")?.["#text"] || null,
        medium: images.find((img) => img.size === "medium")?.["#text"] || null,
        large: images.find((img) => img.size === "large")?.["#text"] || null,
        extralarge:
          images.find((img) => img.size === "extralarge")?.["#text"] || null,
        mega: images.find((img) => img.size === "mega")?.["#text"] || null,
      };

      // Extract genres/tags
      const tags = artist.tags?.tag || [];
      const genres = tags.map((tag) => tag.name);

      resolve({
        name: artist.name,
        url: artist.url,
        images: imageUrls,
        genres: genres,
        bio: artist.bio?.summary || null,
      });
    });

    request.on("error", (err) => {
      console.error(`Error fetching Last.fm data for ${artistName}:`, err);
      resolve(null);
    });
  });
};
