let tokenCache = { token: null, expiresAt: 0 };

function getTokenEndpoint(version) {
  if (version === "3.2") return "https://api.amazon.co.uk/auth/o2/token";
  if (version === "3.3") return "https://api.amazon.co.jp/auth/o2/token";
  return "https://api.amazon.com/auth/o2/token";
}

async function getAccessToken() {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.expiresAt - 60_000) return tokenCache.token;

  const clientId = process.env.AMAZON_CLIENT_ID;
  const clientSecret = process.env.AMAZON_CLIENT_SECRET;
  const version = process.env.AMAZON_CREDENTIAL_VERSION || "3.1";

  if (!clientId || !clientSecret) throw new Error("Amazon Creators API credentials are not configured.");

  const r = await fetch(getTokenEndpoint(version), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "creatorsapi::default"
    })
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Amazon token error (${r.status})`);
  }

  tokenCache.token = data.access_token;
  tokenCache.expiresAt = now + ((data.expires_in || 3600) * 1000);
  return tokenCache.token;
}

function firstNumber(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function deepFind(obj, keys) {
  if (!obj || typeof obj !== "object") return null;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") {
      const found = deepFind(v, keys);
      if (found !== null && found !== undefined) return found;
    }
  }
  return null;
}

function extractPrice(item) {
  const listings = item?.offersV2?.listings || item?.offers?.listings || [];
  const first = Array.isArray(listings) ? listings[0] : null;
  const priceObj = first?.price || first?.pricePerUnit || first?.displayPrice;
  if (priceObj?.amount !== undefined) return firstNumber(priceObj.amount);
  if (priceObj?.displayAmount) return firstNumber(priceObj.displayAmount);
  return firstNumber(deepFind(item, ["priceAmount", "amount", "displayAmount"]));
}

function extractRating(item) {
  const v = deepFind(item, ["averageRating", "rating", "customerRating"]);
  return firstNumber(v);
}

function extractReviews(item) {
  const v = deepFind(item, ["totalReviewCount", "reviewCount", "reviewsCount"]);
  return firstNumber(v);
}

function extractImage(item) {
  return item?.images?.primary?.large?.url ||
         item?.images?.primary?.medium?.url ||
         item?.images?.primary?.small?.url ||
         "";
}

function extractTitle(item) {
  return item?.itemInfo?.title?.displayValue ||
         item?.itemInfo?.title?.label ||
         "Amazon product";
}

function scoreProduct(p, maxReviews, maxRating, budget) {
  const rating = p.rating || 0;
  const reviewStrength = maxReviews ? Math.min(1, (p.reviews || 0) / maxReviews) : 0;
  const ratingStrength = maxRating ? rating / maxRating : 0;
  const budgetFit = budget && p.price ? (p.price <= budget ? 1 : Math.max(0, 1 - ((p.price-budget)/budget))) : 0.5;
  const value = (ratingStrength * 0.48) + (reviewStrength * 0.27) + (budgetFit * 0.25);
  return Math.round(value * 1000) / 10;
}

function labels(sorted) {
  return sorted.map((p, i) => {
    if (i === 0) return {...p, badge: "🏆 Best Overall"};
    if (p.price && sorted[0].price && p.price < sorted[0].price) return {...p, badge: "💰 Best Value"};
    if ((p.rating || 0) >= 4.5) return {...p, badge: "⭐ Best Rated"};
    return {...p, badge: i === sorted.length - 1 ? "👑 Premium Pick" : "Top Pick"};
  });
}

function parseBudget(q) {
  const m = q.match(/(?:under|below|less than|up to|within)\s*\$?\s*(\d+(?:\.\d+)?)/i);
  return m ? Number(m[1]) : null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({error: "Method not allowed"});

  try {
    const q = String(req.query?.q || "").trim();
    if (!q) return res.status(400).json({error: "Please enter a product search."});
    if (q.length > 250) return res.status(400).json({error: "Search is too long."});

    const marketplace = process.env.AMAZON_MARKETPLACE || "www.amazon.com";
    const partnerTag = process.env.AMAZON_PARTNER_TAG || "styleoflife08-21";
    const token = await getAccessToken();
    const budget = parseBudget(q);

    const body = {
      partnerTag,
      marketplace,
      keywords: q,
      searchIndex: "All",
      itemCount: 10,
      sortBy: "Relevance",
      resources: [
        "images.primary.large",
        "itemInfo.title",
        "itemInfo.byLineInfo",
        "offersV2.listings.price",
        "browseNodeInfo.browseNodes"
      ]
    };

    const apiResponse = await fetch("https://creatorsapi.amazon/catalog/v1/searchItems", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-marketplace": marketplace
      },
      body: JSON.stringify(body)
    });

    const data = await apiResponse.json().catch(() => ({}));
    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json({
        error: data?.errors?.[0]?.message || data?.message || `Amazon API error (${apiResponse.status})`
      });
    }

    const items = data?.searchResult?.items || [];
    const parsed = items.map(item => ({
      asin: item.asin,
      title: extractTitle(item),
      image: extractImage(item),
      price: extractPrice(item),
      rating: extractRating(item),
      reviews: extractReviews(item),
      url: item.detailPageURL || `https://${marketplace}/dp/${item.asin}?tag=${encodeURIComponent(partnerTag)}`
    })).filter(x => x.asin && x.title);

    const maxReviews = Math.max(1, ...parsed.map(x => x.reviews || 0));
    const maxRating = Math.max(5, ...parsed.map(x => x.rating || 0));

    const scored = parsed
      .map(p => ({...p, score: scoreProduct(p, maxReviews, maxRating, budget)}))
      .sort((a,b) => b.score - a.score);

    return res.status(200).json({
      query: q,
      budget,
      count: scored.length,
      products: labels(scored.slice(0, 8)),
      source: "Amazon Creators API"
    });
  } catch (e) {
    return res.status(500).json({error: e.message || "Unexpected server error"});
  }
}
