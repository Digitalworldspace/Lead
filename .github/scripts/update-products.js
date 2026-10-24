const fs = require("fs");

const links = JSON.parse(fs.readFileSync("links.json", "utf8"));
const urls = Array.isArray(links) ? links : (links.links || []);

function decode(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getMeta(html, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const patterns = [
    new RegExp(
      '<meta[^>]+(?:property|name)=["\\']' +
      escaped +
      '["\\'][^>]+content=["\\']([^"\\']*)["\\'][^>]*>',
      "i"
    ),
    new RegExp(
      '<meta[^>]+content=["\\']([^"\\']*)["\\'][^>]+(?:property|name)=["\\']' +
      escaped +
      '["\\'][^>]*>',
      "i"
    )
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decode(match[1]);
  }

  return "";
}

async function fetchProduct(url) {
  const product = {
    title: "Amazon Product",
    price: "",
    image: "",
    description: "",
    link: url,
    active: true
  };

  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StyleOfLifeProductFetcher/1.0)",
        "Accept": "text/html,application/xhtml+xml"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    product.title =
      getMeta(html, "og:title") ||
      getMeta(html, "twitter:title") ||
      "Amazon Product";

    product.image =
      getMeta(html, "og:image") ||
      getMeta(html, "twitter:image");

    product.description =
      getMeta(html, "og:description") ||
      getMeta(html, "description") ||
      getMeta(html, "twitter:description");

    const price =
      getMeta(html, "product:price:amount") ||
      getMeta(html, "og:price:amount");

    const currency =
      getMeta(html, "product:price:currency") ||
      getMeta(html, "og:price:currency");

    if (price) {
      product.price = currency ? `${currency} ${price}` : price;
    }
  } catch (error) {
    console.warn(`Could not fetch ${url}: ${error.message}`);
  }

  return product;
}

(async () => {
  const products = [];

  for (const url of urls) {
    if (!url || !/^https?:\/\//i.test(url)) continue;
    products.push(await fetchProduct(url));
  }

  fs.writeFileSync(
    "products.json",
    JSON.stringify(products, null, 2) + "\n"
  );

  console.log(`Created products.json with ${products.length} products.`);
})();
