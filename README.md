# Style Of Life — eBay Shopping (Render)

## GitHub
Upload all files to a GitHub repository. Do not upload `.env`.

## Render
Create **New → Web Service**, connect the repository.

- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`

## Render Environment Variables
- `EBAY_CLIENT_ID` = eBay Production App ID
- `EBAY_CLIENT_SECRET` = eBay Production Cert ID
- `EBAY_PARTNER_CAMPAIGN_ID` = your 10-digit eBay Partner Network campaign ID
- `EBAY_AFFILIATE_REFERENCE_ID` = `styleoflife`
- `EBAY_MARKETPLACE` = `EBAY_US`

The backend keeps the eBay client secret off the browser and uses the eBay Browse API application-token flow. Browse API affiliate URLs are requested through `X-EBAY-C-ENDUSERCTX`.
