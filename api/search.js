function send(res, status, body) {
  res.status(status);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify(body));
}

function num(v) {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function getTitle(x) {
  return x?.itemInfo?.title?.displayValue ||
         x?.itemInfo?.title?.label || "Amazon product";
}

function getImage(x) {
  return x?.images?.primary?.large?.url ||
         x?.images?.primary?.medium?.url ||
         x?.images?.primary?.small?.url || "";
}

function getPrice(x) {
  const listing = x?.offersV2?.listings?.[0] || x?.offers?.listings?.[0];
  const p = listing?.price || listing?.pricePerUnit || {};
  return num(p.amount ?? p.displayAmount ?? p.value);
}

function getRating(x) {
  return num(x?.customerReviews?.starRating ??
             x?.customerReviews?.averageRating ??
             x?.averageRating);
}

function getReviews(x) {
  return num(x?.customerReviews?.count ??
             x?.customerReviews?.totalReviewCount ??
             x?.reviewCount);
}

function getBudget(q) {
  const m = q.match(/(?:under|below|less than|up to|within)\s*\$?\s*(\d+(?:\.\d+)?)/i);
  return m ? Number(m[1]) : null;
}

async function token() {
  const id = process.env.AMAZON_CLIENT_ID;
  const secret = process.env.AMAZON_CLIENT_SECRET;

  if (!id || !secret) {
    throw new Error("AMAZON_CLIENT_ID or AMAZON_CLIENT_SECRET is missing in Vercel Environment Variables.");
  }

  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"},
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
      scope: "creatorsapi::default"
    })
  });

  const raw = await response.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Amazon authentication returned non-JSON (${response.status}).`);
  }

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Amazon authentication failed (${response.status}).`);
  }

  return data.access_token;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return send(res, 405, {error: "Method not allowed"});

  const q = String(req.query?.q || "").trim();
  if (!q) return send(res, 400, {error: "Enter a product search."});

  try {
    const accessToken = await token();
    const marketplace = process.env.AMAZON_MARKETPLACE || "www.amazon.com";
    const partnerTag = process.env.AMAZON_PARTNER_TAG || "styleoflife08-21";

    const requestBody = {
      partnerTag,
      marketplace,
      keywords: q,
      searchIndex: "All",
      itemCount: 10,
      resources: [
        "images.primary.large",
        "images.primary.medium",
        "itemInfo.title",
        "offersV2.listings.price"
      ]
    };

    const response = await fetch(
      "https://creatorsapi.amazon/catalog/v1/searchItems",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "x-marketplace": marketplace
        },
        body: JSON.stringify(requestBody)
      }
    );

    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      return send(res, 502, {
        error: `Amazon returned non-JSON data (${response.status}). Check Creators API access.`
      });
    }

    if (!response.ok) {
      return send(res, response.status, {
        error: data?.errors?.[0]?.message ||
               data?.message ||
               `Amazon API error (${response.status})`
      });
    }

    const budget = getBudget(q);
    const items = data?.searchResult?.items || [];

    let products = items.map(x => ({
      asin: x.asin,
      title: getTitle(x),
      image: getImage(x),
      price: getPrice(x),
      rating: getRating(x),
      reviews: getReviews(x),
      url: x.detailPageURL ||
        `https://${marketplace}/dp/${x.asin}?tag=${encodeURIComponent(partnerTag)}`
    })).filter(x => x.asin && x.title);

    const maxReviews = Math.max(1, ...products.map(x => x.reviews || 0));

    products = products.map(x => {
      const ratingScore = Math.min((x.rating || 0) / 5, 1);
      const reviewScore = Math.min((x.reviews || 0) / maxReviews, 1);
      let budgetScore = 0.5;

      if (budget && x.price !== null) {
        budgetScore = x.price <= budget
          ? 1
          : Math.max(0, 1 - ((x.price - budget) / budget));
      }

      return {
        ...x,
        score: Math.round(
          (ratingScore * .5 + reviewScore * .3 + budgetScore * .2) * 1000
        ) / 10
      };
    }).sort((a,b) => b.score - a.score);

    products.forEach((x, i) => {
      x.badge =
        i === 0 ? "🏆 Best Overall" :
        (budget && x.price !== null && x.price <= budget) ? "💰 Best Value" :
        (x.rating >= 4.5) ? "⭐ Best Rated" :
        "Top Pick";
    });

    return send(res, 200, {
      query: q,
      budget,
      products: products.slice(0, 8)
    });

  } catch (error) {
    return send(res, 500, {
      error: error.message || "Server error"
    });
  }
};
