# Style Of Life — Amazon Live Best Products (FIXED)

## Important
This version fixes the `Unexpected token '<'` problem by:
- using a Vercel serverless API route
- returning JSON even for API errors
- using Vercel rewrites for `/api/search`
- showing a clear frontend error if someone opens the GitHub Pages version

## Deployment
1. Push this folder to GitHub.
2. Import that GitHub repository into Vercel.
3. Add Vercel Environment Variables:
   AMAZON_CLIENT_ID
   AMAZON_CLIENT_SECRET
   AMAZON_CREDENTIAL_VERSION=3.1
   AMAZON_PARTNER_TAG=styleoflife08-21
   AMAZON_MARKETPLACE=www.amazon.com
4. Redeploy.
5. Open the Vercel URL.

DO NOT put AMAZON_CLIENT_SECRET in GitHub/frontend.

If Amazon Creators API is not enabled for the account, the site will return the actual Amazon API error instead of the old HTML/JSON error.
