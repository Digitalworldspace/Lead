# Style Of Life — Amazon Best Products

This is the live-product version of the Style Of Life Smart Shopping site.

## What it does

Customer search:
1. Website sends the query to `/api/search`.
2. Server securely calls Amazon Creators API.
3. Amazon returns live catalog data.
4. Website ranks the returned products using relevance, rating, review strength and budget fit.
5. The site displays Best Overall / Best Value / Best Rated / Top Pick cards.
6. Each card links to Amazon using the Partner Tag.

## Important

GitHub Pages alone cannot safely run this backend because Amazon Creator API credentials are secrets. Use GitHub for the code and Vercel (or another serverless backend) to run `api/search.js`.

Never put `AMAZON_CLIENT_SECRET` in frontend code or a public GitHub file.

## Vercel setup

1. Upload this project to a GitHub repository.
2. Import the repository into Vercel.
3. Add these Environment Variables in Vercel:
   - `AMAZON_CLIENT_ID`
   - `AMAZON_CLIENT_SECRET`
   - `AMAZON_CREDENTIAL_VERSION` (normally `3.1` for NA credentials)
   - `AMAZON_PARTNER_TAG` = `styleoflife08-21`
   - `AMAZON_MARKETPLACE` = `www.amazon.com`
4. Deploy.
5. Open the deployed website and search for a product.

## Amazon access requirement

You must have an accepted Amazon Associates account and approved/available Creators API access with credentials. If the API is not enabled for the account, the website cannot show live Amazon catalog cards yet.

## Ranking

The ranking is intentionally transparent and simple:
- relevance comes from Amazon's SearchItems results
- rating strength
- review-count strength
- budget fit when a query contains "under/below/up to/less than $X"

This is not an Amazon sales-rank claim.
