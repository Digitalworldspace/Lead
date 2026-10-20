# Style Of Life — LIVE Amazon AI Shopping

## What changed

This version has **NO hard-coded/demo product catalog**.

Customer can search for different products, and the backend calls Amazon's official Creators API `SearchItems` operation.

Examples:
- best laptop under $800
- wedding ring
- running shoes for women
- TV for gaming
- vacuum cleaner
- moissanite bracelet under $500
- anniversary gift under $100

The site uses the Amazon US marketplace and the Partner Tag:
`styleoflife08-21`

## Important: credentials

The browser must NOT contain Amazon API secrets.

Create a `.env` file or set server environment variables:

AMAZON_PARTNER_TAG=styleoflife08-21
AMAZON_CLIENT_ID=...
AMAZON_CLIENT_SECRET=...
AMAZON_MARKETPLACE=www.amazon.com

Do NOT commit `.env` to GitHub.

## Run locally

Node.js 18+ is recommended.

```bash
npm install
npm start
```

Open:
http://localhost:3000

## Amazon access requirement

This code is ready for the official Creators API, but Amazon must grant the account access.

Amazon's current documentation says Creators API registration requires a fully accepted Amazon Associates account and qualified sales. Amazon's current troubleshooting documentation also lists an eligibility requirement for API access.

If API access is not enabled, the site will correctly show that live Amazon API is not connected instead of showing fake products.

## Production

Deploy the Node backend to a server/serverless platform that supports environment variables.
Keep the credentials server-side.

Do not scrape Amazon pages to bypass the API. Use Amazon's official API/approved product data access.
