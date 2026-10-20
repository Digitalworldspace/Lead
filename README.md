# Style Of Life — Multi-Store AI Shopping MVP v2

This version is designed around a multi-merchant architecture rather than only Style Of Life products.

## Current MVP
- Conversational shopping query
- Budget extraction
- Multi-merchant-style result cards
- Transparent recommendation scoring
- Merchant/store links
- Responsive UI

## Live product architecture
The frontend should call a backend endpoint such as:
POST /api/search
{
  "query": "best moissanite bracelet under $500 for anniversary",
  "market": "US"
}

The backend should:
1. Parse shopper intent and budget.
2. Query approved product APIs / affiliate feeds.
3. Normalize title, price, currency, merchant, rating, review count, availability, shipping and return data.
4. Deduplicate the same product using GTIN/UPC/EAN/ASIN/MPN when available.
5. Score products by fit, value, reviews, availability, shipping, returns and merchant quality.
6. Return top results with evidence for each score.
7. Generate affiliate/deep links only where the program permits.

## Recommended integrations
- Affiliate.com Product API for broad multi-network product discovery.
- Amazon Creators API for Amazon US where the required Associates/API eligibility is available.
- Add additional merchant/affiliate feeds later.

Do not put API secrets in frontend/GitHub Pages. Use a serverless/backend function and environment variables.

## Important
The demo catalog in this repository is NOT live market data. Connect a legitimate API/feed before presenting prices, availability, ratings or review counts as current.
