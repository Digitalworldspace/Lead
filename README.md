# Style Of Life — GitHub-only Amazon Shopping

This is the simple GitHub-only version.

Customer:
1. Searches any product.
2. The site creates an Amazon US search URL.
3. The URL includes Partner Tag: `styleoflife08-21`.
4. Amazon shows the live/current products.

No products are manually stored in the code.
No Amazon API secret is required.
No backend is required.
No Amazon page scraping is used.

Deploy the repository with GitHub Pages. Open `index.html`.

Important: because this is GitHub-only, the product cards themselves are rendered by Amazon after the customer opens the Amazon results page. A GitHub-only frontend cannot reliably pull Amazon's private/live catalog into its own page without an approved API/backend.
