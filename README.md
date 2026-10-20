# Style Of Life — Amazon Smart Shopping

## Deploy correctly

This project is designed for Vercel.

1. Create a NEW GitHub repository.
2. Upload ALL files from this ZIP to the repository root.
3. In Vercel: Add New Project → Import the GitHub repository.
4. Framework Preset: Other.
5. Build Command: leave empty.
6. Output Directory: leave empty.
7. Add Environment Variables:
   AMAZON_CLIENT_ID
   AMAZON_CLIENT_SECRET
   AMAZON_CREDENTIAL_VERSION = 3.1
   AMAZON_PARTNER_TAG = styleoflife08-21
   AMAZON_MARKETPLACE = www.amazon.com
8. Deploy.
9. Open the Vercel deployment URL.

DO NOT use GitHub Pages for this version.

The old "No entrypoint found" problem is avoided by explicitly defining
@vercel/node and @vercel/static in vercel.json.

The website calls /api/search and displays live Amazon API results.
No demo products are included.
