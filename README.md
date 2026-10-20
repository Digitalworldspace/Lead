# Style Of Life — Live Amazon Search (Vercel fixed)

## Why the previous error happened

`Unexpected token '<', "<!DOCTYPE "... is not valid JSON` means the browser called `/api/search`, but the host returned the HTML page instead of the API JSON.

This happens when a Node/serverless backend is uploaded to **GitHub Pages/static hosting**. GitHub Pages cannot execute `server.js`.

## This version fixes it

This project uses a Vercel serverless function:

- `api/search.js` = live Amazon API backend
- `public/index.html` = frontend
- no hard-coded product catalog
- customer can search arbitrary products
- Amazon credentials stay server-side

## Deploy

1. Push this project to GitHub.
2. Import the repo into Vercel.
3. In Vercel Project Settings → Environment Variables, add:
   - `AMAZON_PARTNER_TAG` = `styleoflife08-21`
   - `AMAZON_CLIENT_ID` = your Amazon Creators API client ID
   - `AMAZON_CLIENT_SECRET` = your Amazon Creators API client secret
   - `AMAZON_MARKETPLACE` = `www.amazon.com`
4. Redeploy.

Do NOT put the Client Secret in `public/index.html`.

If Amazon has not approved/activated Creators API for the Associates account, live API calls will still fail; that is an Amazon access issue, not a frontend issue.
