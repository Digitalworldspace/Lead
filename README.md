# Style Of Life — Bulk Affiliate Links

This version uses **only GitHub + GitHub Actions + GitHub Pages**.

## What you do

Only edit `links.json`.

Example:

[
  "https://example.com/product-1",
  "https://example.com/product-2",
  "https://example.com/product-3"
]

You do NOT manually enter title, price, image or description.

## Automatic flow

1. Put many affiliate URLs in `links.json`.
2. Commit/push to GitHub.
3. GitHub Actions runs automatically.
4. It visits each URL and tries to read:
   - title
   - price
   - main image (Open Graph)
   - description
5. It creates/updates `products.json`.
6. GitHub Pages reads `products.json` and displays the products.

## Important limitation

This is a static GitHub system. It can only fetch information that the destination website allows GitHub Actions to access.

Some sites, especially Amazon and other anti-bot/protected websites, may block automated requests. In that case the link can still be stored, but title/image/price may not be available automatically.

No Vercel and no Supabase are required.
