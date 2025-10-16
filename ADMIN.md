# Admin Section

This admin section allows you to manage concerts/festivals and bands through a web interface instead of using Contentful directly.

## Features

- **Secure Login**: Login with your Contentful Management API credentials
- **Add Concerts/Festivals**: Create new concert or festival entries with all required fields
- **Add Bands**: Create new band entries with name, URL, and image
- **Band Selection**: Select from existing bands when creating concerts
- **Session Management**: Credentials are stored in session storage (cleared when browser closes)
- **Form Validation**: Client-side validation for all required fields

## How to Access

1. Navigate to `/admin` on your Concerts website
2. You'll be presented with a login screen

## Getting Your Credentials

To use the admin interface, you need two pieces of information from Contentful:

### Space ID
1. Go to [Contentful Dashboard](https://app.contentful.com)
2. Select your space
3. Go to Settings → General settings
4. Copy your Space ID

### Management API Token
1. In Contentful, go to Settings → API keys
2. Click on "Content management tokens" tab
3. Generate a new personal access token if you don't have one
4. Copy the token (you'll only see it once!)

## Using the Admin Interface

### Login
1. Enter your Space ID and Management API Token
2. Click "Login"
3. If credentials are valid, you'll be taken to the dashboard

### Adding a Band
1. Click on the "Bands" tab
2. Fill in the form:
   - **Band Name** (required): The name of the band
   - **Band URL** (optional): Link to band's website or social media
   - **Image Asset ID** (optional): Upload an image to Contentful Media first, then paste its Asset ID
3. Click "Create Band"
4. The band will be created and published automatically

### Adding a Concert/Festival
1. Click on the "Concerts" tab
2. Check "This is a festival" if it's a festival (not a single concert)
3. If it's a festival, enter:
   - **Festival Name** (required)
   - **Festival URL** (optional)
4. Fill in the concert/festival details:
   - **Date** (required): Date of the event
   - **Club/Venue** (required): Name of the venue
   - **Latitude** (required): GPS latitude coordinate
   - **Longitude** (required): GPS longitude coordinate
   - **Bands** (required): Select one or more bands from the list
5. Click "Create Concert" or "Create Festival"
6. The entry will be created and published automatically

## Tips

- **Finding Coordinates**: Use [Google Maps](https://maps.google.com) - right-click on the venue location and select "What's here?" to get coordinates
- **Creating Bands First**: Always create bands before creating concerts that reference them
- **Image Assets**: Upload images to Contentful's Media section first, then use the Asset ID in the band form
- **Session Persistence**: Your credentials are stored in session storage until you close the browser or logout

## Security Notes

- Your credentials are stored in your browser's session storage (cleared when you close the browser)
- Never share your Management API token with others
- The token has full write access to your Contentful space
- You can revoke tokens at any time in Contentful settings
- This is a client-side only implementation - no credentials are sent to any server
- For better security, always logout when finished using the admin section

## Troubleshooting

### "Invalid credentials" error
- Double-check your Space ID and Management Token
- Ensure the token hasn't been revoked
- Make sure you're using a Content Management Token, not a Delivery Token

### Band/Concert not appearing on site
- The admin creates and publishes entries automatically
- You may need to rebuild your Gatsby site to see the changes
- Check Contentful to verify the entry was created

### "No bands available" message
- You need to create at least one band before creating a concert
- Click on the "Bands" tab and add a band first

## Technical Implementation

The admin section uses:
- **Contentful Management API** for creating and publishing content
- **React State** for form management
- **Local Storage** for session persistence
- **Client-side validation** for data integrity
- **Gatsby pages** for the admin interface
