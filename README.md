# Style Of Life - GitHub Affiliate Product Site

## How to use

1. Open `links.json`.
2. Put affiliate/product URLs inside the JSON array.
3. Commit and push the change to GitHub.
4. GitHub Actions will fetch available page details and update `products.json`.
5. GitHub Pages will automatically show the products.

Example:

[
  "https://example.com/product-1",
  "https://example.com/product-2"
]

## Important

Some websites block automated requests or hide product information behind JavaScript. In those cases, the affiliate link is still kept, but title/image/price may not be available automatically.

## GitHub Pages

Set GitHub Pages to deploy from the repository branch/root containing `index.html`.

If the workflow cannot push `products.json`, check:
Repository -> Settings -> Actions -> General -> Workflow permissions -> Read and write permissions.
