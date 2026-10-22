const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function cleanAmazonUrl(raw) {
  try {
    const u = new URL(raw);
    if (!/(^|\.)amazon\./i.test(u.hostname)) return null;
    const asinMatch = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
    if (!asinMatch) return null;
    const asin = asinMatch[1].toUpperCase();
    return `https://www.amazon.com/dp/${asin}?tag=styleoflife08-21`;
  } catch {
    return null;
  }
}

function getAsin(raw) {
  try {
    const u = new URL(raw);
    const m = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
    return m ? m[1].toUpperCase() : null;
  } catch { return null; }
}

app.post("/api/product", (req, res) => {
  const { amazonUrl, title, price, image, advantages, badge } = req.body || {};
  const url = cleanAmazonUrl(amazonUrl || "");
  if (!url) {
    return res.status(400).json({
      error: "Please enter a valid Amazon product URL containing an ASIN."
    });
  }

  const product = {
    asin: getAsin(amazonUrl),
    title: String(title || "Amazon Product").slice(0, 180),
    price: String(price || "See price on Amazon").slice(0, 60),
    image: String(image || "").slice(0, 1000),
    advantages: String(advantages || "")
      .split(/\n|,/)
      .map(x => x.trim())
      .filter(Boolean)
      .slice(0, 6),
    badge: String(badge || "Style Of Life Pick").slice(0, 40),
    amazonUrl: url
  };

  res.json(product);
});

app.listen(PORT, () => console.log(`Style Of Life Amazon Link Box running on ${PORT}`));
