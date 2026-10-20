const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const AMAZON_TAG = process.env.AMAZON_PARTNER_TAG || "styleoflife08-21";
const AMAZON_CLIENT_ID = process.env.AMAZON_CLIENT_ID || "";
const AMAZON_CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET || "";
const AMAZON_MARKETPLACE = process.env.AMAZON_MARKETPLACE || "www.amazon.com";
const AMAZON_API_BASE = "https://creatorsapi.amazon";
const AMAZON_TOKEN_URL = "https://api.amazon.com/auth/o2/token";

let tokenCache = { accessToken: null, expiresAt: 0 };

app.use(express.json());
app.use(express.static("public"));

function cleanQuery(q) {
  return String(q || "").trim().slice(0, 200);
}

function extractBudget(q) {
  const m = q.match(/(?:under|below|less than|up to)\s*\$?\s*([\d,]+)/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function getAccessToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }

  if (!AMAZON_CLIENT_ID || !AMAZON_CLIENT_SECRET) {
    const err = new Error("Amazon Creators API credentials are not configured.");
    err.code = "AMAZON_CREDENTIALS_MISSING";
    throw err;
  }

  const response = await fetch(AMAZON_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: AMAZON_CLIENT_ID,
      client_secret: AMAZON_CLIENT_SECRET,
      scope: "creatorsapi::default"
    })
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    const err = new Error(data.error_description || data.message || "Amazon authentication failed.");
    err.code = "AMAZON_AUTH_FAILED";
    throw err;
  }

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in || 3600) * 1000)
  };
  return tokenCache.accessToken;
}

function parseItem(item) {
  const title =
    item?.itemInfo?.title?.displayValue ||
    item?.itemInfo?.title?.displayValue ||
    "Amazon product";

  const image =
    item?.images?.primary?.large?.url ||
    item?.images?.primary?.medium?.url ||
    item?.images?.primary?.small?.url ||
    "";

  const listings = item?.offersV2?.listings || [];
  const prices = listings
    .map(x => x?.price?.amount)
    .filter(x => typeof x === "number");

  const price = prices.length ? Math.min(...prices) : null;

  const rating =
    item?.customerReviews?.starRating?.value ??
    item?.itemInfo?.customerReviews?.starRating?.value ??
    null;

  const reviewCount =
    item?.customerReviews?.count ??
    item?.itemInfo?.customerReviews?.count ??
    null;

  return {
    asin: item?.asin || "",
    title,
    image,
    price,
    currency: listings[0]?.price?.currency || "USD",
    rating,
    reviewCount,
    url: item?.detailPageURL || ""
  };
}

async function searchAmazon(query, budget) {
  const accessToken = await getAccessToken();

  const body = {
    keywords: query,
    searchIndex: "All",
    itemCount: 10,
    itemPage: 1,
    partnerTag: AMAZON_TAG,
    marketplace: AMAZON_MARKETPLACE,
    resources: [
      "images.primary.large",
      "images.primary.medium",
      "itemInfo.title",
      "offersV2.listings.price",
      "customerReviews"
    ]
  };

  if (budget !== null) body.maxPrice = Math.round(budget * 100);

  const response = await fetch(`${AMAZON_API_BASE}/catalog/v1/searchItems`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-marketplace": AMAZON_MARKETPLACE
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data.message || data.errors?.[0]?.message || "Amazon SearchItems failed.");
    err.status = response.status;
    err.amazon = data;
    throw err;
  }

  return (data?.searchResult?.items || []).map(parseItem);
}

app.get("/api/status", (req, res) => {
  res.json({
    liveAmazonApiConfigured: Boolean(AMAZON_CLIENT_ID && AMAZON_CLIENT_SECRET),
    marketplace: AMAZON_MARKETPLACE,
    partnerTagConfigured: Boolean(AMAZON_TAG)
  });
});

app.get("/api/search", async (req, res) => {
  try {
    const query = cleanQuery(req.query.q);
    if (!query) return res.status(400).json({ error: "Enter a shopping request." });

    const budget = extractBudget(query);
    const products = await searchAmazon(query, budget);

    res.json({
      query,
      budget,
      source: "Amazon Creators API",
      products
    });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;

    if (err.code === "AMAZON_CREDENTIALS_MISSING") {
      return res.status(503).json({
        error: "Live Amazon API is not connected yet.",
        code: "AMAZON_CREDENTIALS_MISSING"
      });
    }

    res.status(status).json({
      error: err.message || "Unable to search Amazon live.",
      code: err.code || "AMAZON_SEARCH_ERROR"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Style Of Life AI Shopping running on http://localhost:${PORT}`);
});
