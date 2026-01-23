import { createClient } from 'contentful';

// Validate required environment variables
const spaceId = process.env.CONTENTFUL_SPACE_ID;
const accessToken = process.env.CONTENTFUL_DELIVERY_TOKEN;

if (!spaceId || !accessToken) {
  const missing = [];
  if (!spaceId) missing.push('CONTENTFUL_SPACE_ID');
  if (!accessToken) missing.push('CONTENTFUL_DELIVERY_TOKEN');
  
  throw new Error(
    `Missing required Contentful environment variables: ${missing.join(', ')}. ` +
    `Please check your .env.local file and ensure all required variables are set.`
  );
}

const client = createClient({
  space: spaceId,
  accessToken: accessToken,
});

export default client;
