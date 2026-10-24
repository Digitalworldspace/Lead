const fs = require("fs");

const links = JSON.parse(
  fs.readFileSync("links.json", "utf8")
);

const urls = Array.isArray(links)
  ? links
  : (links.links || []);

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getMeta(html, key) {
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];

  for (const tag of metaTags) {
    const propertyMatch = tag.match(
      /\b(?:property|name)\s*=\s*["']([^"']+)["']/i
    );

    const contentMatch = tag.match(
      /\bcontent\s*=\s*["']([^"']*)["']/i
    );

    if (
      propertyMatch &&
      contentMatch &&
      propertyMatch[1].toLowerCase() === key.toLowerCase()
    ) {
      return decodeHtml(contentMatch[1]);
    }

    const contentFirstMatch = tag.match(
      /\bcontent\s*=\s*["']([^"']*)["']/i
    );

    const propertySecondMatch = tag.match(
      /\b(?:property|name)\s*=\s*["']([^"']+)["']/i
    );

    if (
      contentFirstMatch &&
      propertySecondMatch &&
      propertySecondMatch[1].toLowerCase() === key.toLowerCase()
    ) {
      return decodeHtml(contentFirstMatch[1]);
    }
  }

  return "";
}

function getTitleFromHtml(html) {
  const match = html.match(
    /<title[^>]*>([\s\S]*?)<\/title>/i
  );

  return match
    ? decodeHtml(match[1].trim())
    : "";
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
    console.log("Fetching:", url);

    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      throw new Error(
        "HTTP " + response.status
      );
    }

    const html = await response.text();

    product.title =
      getMeta(html, "og:title") ||
      getMeta(html, "twitter:title") ||
      getTitleFromHtml(html) ||
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
      product.price = currency
        ? currency + " " + price
        : price;
    }

    console.log(
      "Product found:",
      product.title
    );

  } catch (error) {
    console.log(
      "Could not fetch:",
      url
    );

    console.log(
      "Reason:",
      error.message
    );

    /*
      Even if Amazon blocks the request,
      keep the original affiliate URL.
    */
  }

  return product;
}

async function main() {
  const products = [];

  for (const url of urls) {

    if (
      !url ||
      !/^https?:\/\//i.test(url)
    ) {
      console.log(
        "Skipping invalid URL:",
        url
      );

      continue;
    }

    const product =
      await fetchProduct(url);

    products.push(product);
  }

  fs.writeFileSync(
    "products.json",
    JSON.stringify(
      products,
      null,
      2
    ) + "\n"
  );

  console.log(
    "--------------------------------"
  );

  console.log(
    "products.json created successfully"
  );

  console.log(
    "Total products:",
    products.length
  );

  console.log(
    "--------------------------------"
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
