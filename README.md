# Style Of Life — Amazon Live + Personalized Shopping

This version uses Amazon Creators API for LIVE Amazon catalog data.

## What changed
- LIVE `SearchItems` search.
- LIVE `GetItems` for featured products you choose by Amazon URL/ASIN.
- Featured product cards show Amazon image, current offer price when returned, availability/buy-box information, and Amazon-provided feature advantages.
- Customer browser language is detected and the storefront UI changes automatically for English, Spanish, French, German, Portuguese, Hindi, and Gujarati. Amazon API language preference is used only when that locale is supported by the selected marketplace.
- Approximate visitor city/state is detected from IP for personalization. It is display-only and should never be treated as an exact address.
- No Amazon Client Secret is exposed to the frontend.

## Put your own Amazon products
Set `FEATURED_AMAZON_LINKS` to comma-separated Amazon product URLs, for example:
`https://www.amazon.com/dp/ASIN1,https://www.amazon.com/dp/ASIN2`

The server extracts the ASIN and calls Amazon Creators API `GetItems`; it does NOT scrape Amazon product pages.

## Environment
AMAZON_CLIENT_ID=...
AMAZON_CLIENT_SECRET=...
AMAZON_CREDENTIAL_VERSION=3.1
AMAZON_PARTNER_TAG=styleoflife08-21
AMAZON_MARKETPLACE=www.amazon.com
FEATURED_AMAZON_LINKS=...
PORT=3000

## Run
npm install
npm start

Amazon's documentation: SearchItems returns up to 10 items and supports Images, ItemInfo and OffersV2 resources. GetItems can retrieve item attributes, images, features and offer information for specified ASINs.
