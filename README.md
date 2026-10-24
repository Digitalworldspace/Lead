# Style Of Life - GitHub Affiliate Product Website

## Files

- `index.html` = customer website
- `links.json` = add/remove affiliate links here
- `products.json` = generated automatically
- `.github/workflows/update-products.yml` = GitHub Actions workflow
- `.github/scripts/update-products.js` = product detail fetcher

## How it works

1. Add Amazon affiliate URLs to `links.json`.
2. Commit and push.
3. GitHub Actions runs automatically.
4. It creates/updates `products.json`.
5. GitHub Pages displays the products.
6. `Shop Now` opens the exact affiliate URL from `links.json` directly in a new tab.

## Important

Amazon can block automated requests or hide product information. If Amazon blocks the request, the product may still appear with a generic title and the original affiliate link. The `Shop Now` button uses the original URL.

## If the workflow cannot push

Go to:

Repository -> Settings -> Actions -> General -> Workflow permissions

Select:

`Read and write permissions`

Then save.

## Manual run

GitHub -> Actions -> Update Product Details -> Run workflow
