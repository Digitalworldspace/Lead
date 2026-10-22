const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.AMAZON_CLIENT_ID;
const CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET;
const CREDENTIAL_VERSION = process.env.AMAZON_CREDENTIAL_VERSION || '3.1';
const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG || 'styleoflife08-21';
const MARKETPLACE = process.env.AMAZON_MARKETPLACE || 'www.amazon.com';

// Put your chosen Amazon product URLs here, comma-separated, or set them as an env variable.
const FEATURED_LINKS = (process.env.FEATURED_AMAZON_LINKS || '').split(',').map(x => x.trim()).filter(Boolean);
let tokenCache = { accessToken: null, expiresAt: 0 };

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function tokenEndpoint() {
  if (CREDENTIAL_VERSION === '3.2') return 'https://api.amazon.co.uk/auth/o2/token';
  if (CREDENTIAL_VERSION === '3.3') return 'https://api.amazon.co.jp/auth/o2/token';
  return 'https://api.amazon.com/auth/o2/token';
}

function extractAsin(value) {
  const s = String(value || '').trim();
  const m = s.match(/(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|asin=)([A-Z0-9]{10})/i) || s.match(/\b([A-Z0-9]{10})\b/i);
  return m ? m[1].toUpperCase() : null;
}

async function getAccessToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Amazon credentials are not configured. Add AMAZON_CLIENT_ID and AMAZON_CLIENT_SECRET in your server environment.');
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt - 60000) return tokenCache.accessToken;

  const response = await fetch(tokenEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'creatorsapi::default'
    })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || 'Amazon authentication failed.');
  tokenCache = { accessToken: data.access_token, expiresAt: Date.now() + ((data.expires_in || 3600) * 1000) };
  return tokenCache.accessToken;
}

function firstOffer(item) {
  return item?.offersV2?.listings?.[0] || null;
}
function priceOf(item) { return firstOffer(item)?.price?.money?.amount ?? null; }
function displayPriceOf(item) { return firstOffer(item)?.price?.money?.displayAmount || ''; }
function featuresOf(item) { return item?.itemInfo?.features?.displayValues || []; }

function normalizeItem(item) {
  const offer = firstOffer(item);
  return {
    asin: item.asin,
    title: item?.itemInfo?.title?.displayValue || 'Amazon product',
    image: item?.images?.primary?.large?.url || item?.images?.primary?.medium?.url || item?.images?.primary?.small?.url || '',
    price: priceOf(item),
    displayPrice: displayPriceOf(item),
    currency: offer?.price?.money?.currency || 'USD',
    url: item.detailPageURL || '',
    seller: offer?.merchantInfo?.name || '',
    availability: offer?.availability?.type || '',
    buyBox: Boolean(offer?.isBuyBoxWinner),
    deal: Boolean(offer?.dealDetails),
    features: featuresOf(item).slice(0, 5),
    parentASIN: item.parentASIN || null
  };
}

function rankProducts(items) {
  const valid = items.filter(x => x.url && x.title);
  if (!valid.length) return [];
  const numeric = valid.map(x => typeof x.price === 'number' ? x.price : Infinity).filter(Number.isFinite);
  const min = numeric.length ? Math.min(...numeric) : Infinity;
  const max = numeric.length ? Math.max(...numeric) : Infinity;
  return valid.map(p => {
    let score = 50;
    if (p.buyBox) score += 15;
    if (p.availability === 'IN_STOCK') score += 15;
    if (p.deal) score += 8;
    if (Number.isFinite(p.price) && Number.isFinite(min) && Number.isFinite(max) && max > min) score += ((max - p.price) / (max - min)) * 12;
    return { ...p, score };
  }).sort((a,b) => b.score - a.score);
}

async function creatorsPost(operation, payload) {
  const token = await getAccessToken();
  const response = await fetch(`https://creatorsapi.amazon/catalog/v1/${operation}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-marketplace': MARKETPLACE
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Amazon ${operation} failed: ${JSON.stringify(data)}`);
  return data;
}

app.get('/api/health', (_, res) => res.json({ ok: true, amazonConfigured: Boolean(CLIENT_ID && CLIENT_SECRET), marketplace: MARKETPLACE, partnerTag: PARTNER_TAG }));

app.get('/api/location', async (req, res) => {
  try {
    // IP-derived location is approximate. We use it only for display/personalization.
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = forwarded || req.socket.remoteAddress || '';
    const url = ip && !ip.includes('127.0.0.1') && !ip.includes('::1') ? `https://ipapi.co/${encodeURIComponent(ip)}/json/` : 'https://ipapi.co/json/';
    const r = await fetch(url, { headers: { 'User-Agent': 'StyleOfLife-Amazon-Shop/1.0' } });
    const d = await r.json();
    res.json({ country: d.country_name || '', countryCode: d.country_code || '', state: d.region || '', stateCode: d.region_code || '', city: d.city || '', approximate: true });
  } catch {
    res.json({ country: '', countryCode: '', state: '', stateCode: '', city: '', approximate: true });
  }
});

app.get('/api/featured', async (_, res) => {
  try {
    const asins = FEATURED_LINKS.map(extractAsin).filter(Boolean).slice(0, 10);
    if (!asins.length) return res.json({ products: [], message: 'Add Amazon product URLs to FEATURED_AMAZON_LINKS.' });
    const data = await creatorsPost('getItems', {
      itemIds: asins,
      itemIdType: 'ASIN',
      marketplace: MARKETPLACE,
      partnerTag: PARTNER_TAG,
      resources: [
        'images.primary.large', 'images.primary.medium', 'images.primary.small',
        'itemInfo.title', 'itemInfo.features', 'itemInfo.byLineInfo',
        'offersV2.listings.price', 'offersV2.listings.availability',
        'offersV2.listings.merchantInfo', 'offersV2.listings.isBuyBoxWinner',
        'offersV2.listings.dealDetails'
      ]
    });
    const products = (data?.itemsResult?.items || []).map(normalizeItem);
    products.forEach((p, i) => p.badge = i === 0 ? 'Best Overall' : 'Featured Pick');
    res.json({ products });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/search', async (req, res) => {
  const keywords = String(req.query.q || '').trim();
  const maxPrice = Number(req.query.maxPrice || 0);
  const language = String(req.query.language || '').trim();
  if (!keywords) return res.status(400).json({ error: 'Enter a shopping request.' });
  try {
    const payload = {
      keywords,
      searchIndex: 'All',
      itemCount: 10,
      condition: 'New',
      availability: 'Available',
      currencyOfPreference: 'USD',
      marketplace: MARKETPLACE,
      partnerTag: PARTNER_TAG,
      resources: [
        'images.primary.large', 'images.primary.medium', 'images.primary.small',
        'itemInfo.title', 'itemInfo.features', 'itemInfo.byLineInfo',
        'offersV2.listings.price', 'offersV2.listings.availability',
        'offersV2.listings.merchantInfo', 'offersV2.listings.isBuyBoxWinner',
        'offersV2.listings.dealDetails'
      ]
    };
    const allowedUS = ['en_US','es_US','de_DE','ko_KR','pt_BR','zh_CN','zh_TW'];
    if (allowedUS.includes(language)) payload.languagesOfPreference = [language];
    if (maxPrice > 0) payload.maxPrice = Math.round(maxPrice * 100);
    const data = await creatorsPost('searchItems', payload);
    const ranked = rankProducts((data?.searchResult?.items || []).map(normalizeItem));
    const badges = ['Best Overall', 'Best Value', 'Premium Pick', 'Best Rated'];
    ranked.forEach((p, i) => p.badge = badges[i] || 'Amazon Pick');
    res.json({ live: true, source: 'Amazon Creators API', marketplace: MARKETPLACE, totalResults: data?.searchResult?.totalResultCount || ranked.length, products: ranked });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`Style Of Life Amazon app running on port ${PORT}`));
