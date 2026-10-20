import express from "express";

const app = express();
const PORT = process.env.PORT || 10000;
const EBAY_API = "https://api.ebay.com";
const marketplace = process.env.EBAY_MARKETPLACE || "EBAY_US";

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

let tokenCache = { accessToken: null, expiresAt: 0 };

function env(name) {
  if (!process.env[name]) {
    const e = new Error(`${name} is missing in Render Environment Variables.`);
    e.code = "MISSING_ENV";
    throw e;
  }
  return process.env[name];
}

async function getToken() {
  const clientId = env("EBAY_CLIENT_ID");
  const clientSecret = env("EBAY_CLIENT_SECRET");

  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.accessToken;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${EBAY_API}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${basic}`
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope"
    })
  });

  const data = await response.json();
  if (!response.ok) {
    const e = new Error(data.error_description || data.error || "eBay OAuth failed.");
    e.status = response.status;
    throw e;
  }

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Number(data.expires_in || 7200) * 1000
  };
  return tokenCache.accessToken;
}

function score(item, query) {
  const title = String(item.title || "").toLowerCase();
  const words = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const relevance = words.reduce((n, w) => n + (title.includes(w) ? 5 : 0), 0);
  const sellerRating = Math.min(Number(item.seller?.feedbackPercentage || 0) / 20, 5);
  const sellerFeedback = Math.min(Math.log10(Number(item.seller?.feedbackScore || 0) + 1), 5);
  return Number((relevance + sellerRating + sellerFeedback).toFixed(2));
}

function normalize(item, query) {
  return {
    id: item.itemId,
    title: item.title || "eBay item",
    image: item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl || "",
    price: item.price?.value ?? null,
    currency: item.price?.currency || "USD",
    condition: item.condition || "",
    seller: {
      username: item.seller?.username || "",
      feedbackPercentage: item.seller?.feedbackPercentage ?? null,
      feedbackScore: item.seller?.feedbackScore ?? null
    },
    webUrl: item.itemWebUrl || "",
    affiliateUrl: item.itemAffiliateWebUrl || item.itemWebUrl || "",
    score: score(item, query)
  };
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "Style Of Life eBay Shopping", marketplace });
});

app.get("/api/search", async (req, res) => {
  try {
    const query = String(req.query.q || "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (!query) return res.status(400).json({ ok: false, error: "Please enter a product search." });

    const token = await getToken();
    const campaignId = env("EBAY_PARTNER_CAMPAIGN_ID");
    const referenceId = process.env.EBAY_AFFILIATE_REFERENCE_ID || "styleoflife";

    const params = new URLSearchParams({ q: query, limit: "20", sort: "BEST_MATCH" });
    const response = await fetch(
      `${EBAY_API}/buy/browse/v1/item_summary/search?${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "X-EBAY-C-MARKETPLACE-ID": marketplace,
          "X-EBAY-C-ENDUSERCTX": `affiliateCampaignId=${campaignId},affiliateReferenceId=${referenceId}`
        }
      }
    );

    const data = await response.json();
    if (!response.ok) {
      const e = new Error(
        data?.errors?.[0]?.longMessage ||
        data?.errors?.[0]?.message ||
        "eBay Browse API failed."
      );
      e.status = response.status;
      throw e;
    }

    const items = (data.itemSummaries || [])
      .map(x => normalize(x, query))
      .filter(x => x.affiliateUrl)
      .sort((a, b) => b.score - a.score);

    const bestOverall = items[0] || null;
    const bestValue = [...items].filter(x => Number(x.price) > 0)
      .sort((a, b) => Number(a.price) - Number(b.price))[0] || null;
    const bestRated = [...items].sort((a, b) =>
      Number(b.seller.feedbackPercentage || 0) - Number(a.seller.feedbackPercentage || 0) ||
      Number(b.seller.feedbackScore || 0) - Number(a.seller.feedbackScore || 0)
    )[0] || null;
    const premium = [...items].filter(x => Number(x.price) > 0)
      .sort((a, b) => Number(b.price) - Number(a.price))[0] || null;

    res.json({
      ok: true,
      query,
      total: data.total ?? items.length,
      recommendations: { bestOverall, bestValue, bestRated, premium },
      items
    });
  } catch (e) {
    console.error(e);
    res.status(e.status || 500).json({
      ok: false,
      error: e.message || "Search failed.",
      code: e.code || "SEARCH_FAILED"
    });
  }
});

app.get("*", (req, res) => {
  res.sendFile("index.html", { root: "public" });
});

app.listen(PORT, "0.0.0.0", () => console.log(`Running on port ${PORT}`));
