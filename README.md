# Style Of Life - Affiliate Product Website

## Files
- `index.html` — customer website
- `links.json` — add/remove affiliate links here
- `products.json` — generated automatically
- `.github/workflows/update-products.yml` — fetches available page details

## How it works
1. Add affiliate URLs to `links.json`.
2. Commit the change.
3. GitHub Actions runs automatically.
4. It updates `products.json` with any details the destination page exposes.
5. GitHub Pages reads `products.json` and displays the products.
6. `Shop Now` uses the exact original affiliate URL from `links.json` and opens it directly in a new tab.

## Important
Amazon can block automated requests or hide product information. If that happens, title/image/price may not be available automatically, but the original affiliate URL is preserved for `Shop Now`.

If Actions cannot push `products.json`, go to:
Repository Settings -> Actions -> General -> Workflow permissions -> Read and write permissions.
