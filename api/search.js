function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function parseNumber(v) {
  if (v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function titleOf(item) {
  return item?.itemInfo?.title?.displayValue ||
    item?.itemInfo?.title?.label ||
    item?.itemInfo?.title?.value ||
    "Amazon product";
}

function imageOf(item) {
  return item?.images?.primary?.large?.url ||
    item?.images?.primary?.medium?.url ||
    item?.images?.primary?.small?.url ||
    "";
}

function priceOf(item) {
  const listing = item?.offersV2?.listings?.[0] || item?.offers?.listings?.[0];
  const p = listing?.price || listing?.pricePerUnit || {};
  return parseNumber(p.amount ?? p.displayAmount ?? p.value);
}

function ratingOf(item) {
  return parseNumber(
    item?.customerReviews?.starRating ??
    item?.customerReviews?.averageRating ??
    item?.reviews?.averageRating ??
    item?.averageRating
  );
}

function reviewsOf(item) {
  return parseNumber(
    item?.customerReviews?.count ??
    item?.customerReviews?.totalReviewCount ??
    item?.reviews?.count ??
    item?.reviewCount
  );
}

async function getToken() {
  const id = process.env.AMAZON_CLIENT_ID;
  const secret = process.env.AMAZON_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Missing Amazon API credentials in Vercel Environment Variables.");

  const r = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: {"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
      scope: "creatorsapi::default"
    })
  });

  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Amazon token returned non-JSON response (${r.status}).`); }
  if (!r.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `Amazon token error (${r.status}).`);
  }
  return data.access_token;
}

function score(p, maxReviews, budget) {
  const rating = p.rating || 0;
  const ratingScore = Math.min(rating / 5, 1);
  const reviewScore = Math.min((p.reviews || 0) / Math.max(maxReviews, 1), 1);
  let budgetScore = 0.5;
  if (budget && p.price != null) {
    budgetScore = p.price <= budget ? 1 : Math.max(0, 1 - ((p.price-budget)/budget));
  }
  return Math.round((ratingScore*.50 + reviewScore*.30 + budgetScore*.20) * 1000) / 10;
}

function budgetFrom(q) {
  const m = q.match(/(?:under|below|less than|up to|within)\s*\$?\s*(\d+(?:\.\d+)?)/i);
  return m ? Number(m[1]) : null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return json(res, 405, {error:"Method not allowed"});

  const q = String(req.query?.q || "").trim();
  if (!q) return json(res, 400, {error:"Enter a product search."});

  try {
    const token = await getToken();
    const marketplace = process.env.AMAZON_MARKETPLACE || "www.amazon.com";
    const partnerTag = process.env.AMAZON_PARTNER_TAG || "styleoflife08-21";

    const payload = {
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

    const r = await fetch("https://creatorsapi.amazon/catalog/v1/searchItems", {
      method:"POST",
      headers:{
        "Authorization":`Bearer ${token}`,
        "Content-Type":"application/json",
        "x-marketplace":marketplace
      },
      body:JSON.stringify(payload)
    });

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); }
    catch { return json(res, 502, {error:`Amazon API returned non-JSON (${r.status}). Check Creators API access and credentials.`}); }

    if (!r.ok) {
      return json(res, r.status, {
        error:data?.errors?.[0]?.message || data?.message || `Amazon API error (${r.status})`,
        amazon:data
      });
    }

    const items = data?.searchResult?.items || [];
    const products = items.map(item => ({
      asin:item.asin,
      title:titleOf(item),
      image:imageOf(item),
      price:priceOf(item),
      rating:ratingOf(item),
      reviews:reviewsOf(item),
      url:item.detailPageURL || `https://${marketplace}/dp/${item.asin}?tag=${encodeURIComponent(partnerTag)}`
    })).filter(p => p.asin && p.title);

    const maxReviews = Math.max(1, ...products.map(p=>p.reviews||0));
    const budget = budgetFrom(q);

    products.forEach(p => p.score = score(p,maxReviews,budget));
    products.sort((a,b)=>b.score-a.score);

    products.forEach((p,i) => {
      p.badge = i===0 ? "🏆 Best Overall" :
        (budget && p.price!=null && p.price<=budget ? "💰 Best Value" :
        (p.rating>=4.5 ? "⭐ Best Rated" : "Top Pick"));
    });

    return json(res,200,{query:q,budget,products:products.slice(0,8)});
  } catch (e) {
    return json(res,500,{error:e.message || "Server error"});
  }
};
