# Style Of Life — GitHub Only + products.json

No Vercel. No Supabase. No database.

Files:
- `index.html` = customer website
- `products.json` = ALL products and affiliate links
- `admin.html` = helper page that generates a product JSON entry

## Add a product
1. Open `admin.html`.
2. Enter product details and affiliate link.
3. Click **Generate Product JSON**.
4. Copy the generated JSON object.
5. Open `products.json` in GitHub.
6. Add the object inside the `[ ... ]` list.
7. Commit the change.
8. GitHub Pages will then show the product.

Example:
[
  {
    "title": "Product Name",
    "price": "$29.99",
    "image": "https://example.com/image.jpg",
    "description": "Short product description.",
    "link": "https://example.com/affiliate-link",
    "active": true
  }
]

Set `"active": false` to hide a product.

This is fully static. Anyone can see the affiliate links in the website source, which is normal for affiliate links.
