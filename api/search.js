const AMAZON_TAG = process.env.AMAZON_PARTNER_TAG || "styleoflife08-21";
const CLIENT_ID = process.env.AMAZON_CLIENT_ID || "";
const CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET || "";
const MARKETPLACE = process.env.AMAZON_MARKETPLACE || "www.amazon.com";

let cached = { token: null, expiresAt: 0 };

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function budgetFrom(q) {
  const m = q.match(/(?:under|below|less than|up to)\s*\$?\s*([\d,]+)/i);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

async function token() {
  if (cached.token && Date.now() < cached.expiresAt - 60000) return cached.token;
  if (!CLIENT_ID || !CLIENT_SECRET) {
    const e = new Error("Amazon Creators API credentials are missing.");
    e.code = "MISSING_CREDENTIALS";
    throw e;
  }

  const r = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: {"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: "creatorsapi::default"
    })
  });
  const d = await r.json().catch(()=>({}));
  if (!r.ok || !d.access_token) {
    const e = new Error(d.error_description || d.message || "Amazon authentication failed.");
    e.status = r.status;
    throw e;
  }
  cached = {token:d.access_token, expiresAt:Date.now()+Number(d.expires_in||3600)*1000};
  return cached.token;
}

function item(x) {
  const listings = x?.offersV2?.listings || [];
  const prices = listings.map(v=>v?.price?.amount).filter(v=>typeof v==="number");
  return {
    asin: x?.asin || "",
    title: x?.itemInfo?.title?.displayValue || "Amazon product",
    image: x?.images?.primary?.large?.url || x?.images?.primary?.medium?.url || "",
    price: prices.length ? Math.min(...prices) : null,
    currency: listings[0]?.price?.currency || "USD",
    rating: x?.customerReviews?.starRating?.value ?? null,
    reviewCount: x?.customerReviews?.count ?? null,
    url: x?.detailPageURL || ""
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, {error:"GET only"});

  try {
    const q = String(req.query?.q || "").trim().slice(0,200);
    if (!q) return send(res, 400, {error:"Enter a shopping request."});

    const access = await token();
    const body = {
      keywords:q,
      searchIndex:"All",
      itemCount:10,
      itemPage:1,
      partnerTag:AMAZON_TAG,
      marketplace:MARKETPLACE,
      resources:[
        "images.primary.large",
        "images.primary.medium",
        "itemInfo.title",
        "offersV2.listings.price",
        "customerReviews"
      ]
    };

    const r = await fetch("https://creatorsapi.amazon/catalog/v1/searchItems", {
      method:"POST",
      headers:{
        "Authorization":`Bearer ${access}`,
        "Content-Type":"application/json",
        "x-marketplace":MARKETPLACE
      },
      body:JSON.stringify(body)
    });

    const d = await r.json().catch(()=>({}));
    if (!r.ok) {
      return send(res, r.status, {
        error:d.message || d.errors?.[0]?.message || "Amazon API request failed.",
        amazonStatus:r.status
      });
    }

    return send(res,200,{
      query:q,
      source:"Amazon Creators API",
      products:(d?.searchResult?.items || []).map(item)
    });
  } catch(e) {
    console.error(e);
    return send(res,e.status || 500,{
      error:e.message || "Live Amazon search failed.",
      code:e.code || "SERVER_ERROR"
    });
  }
}
