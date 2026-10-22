const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const AMAZON_TAG = process.env.AMAZON_PARTNER_TAG || 'styleoflife08-21';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function cors(req, res) {
  const allowed = process.env.FRONTEND_URL || '*';
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', allowed === '*' ? '*' : (origin === allowed ? origin : allowed));
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Vary', 'Origin');
}

function body(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function requireAdmin(req, res) {
  if (!ADMIN_TOKEN) {
    json(res, 500, { error: 'ADMIN_TOKEN is missing in Vercel Environment Variables.' });
    return false;
  }
  if (req.headers['x-admin-token'] !== ADMIN_TOKEN) {
    json(res, 401, { error: 'Wrong ADMIN_TOKEN.' });
    return false;
  }
  return true;
}

function parseAmazon(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    if (!/(^|\.)amazon\.com$/i.test(u.hostname)) {
      return { error: 'Please use an Amazon.com product link. Your affiliate tag is for Amazon US.' };
    }
    const m = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i);
    if (!m) return { error: 'Amazon ASIN not found. Use a link containing /dp/ASIN.' };
    const asin = m[1].toUpperCase();
    return { asin, affiliateUrl: `https://www.amazon.com/dp/${asin}?tag=${encodeURIComponent(AMAZON_TAG)}` };
  } catch {
    return { error: 'Invalid Amazon product URL.' };
  }
}

async function supabase(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase environment variables are missing.');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw new Error(data?.message || data?.hint || `Supabase error ${r.status}`);
  return data;
}

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      return json(res, 200, { ok: true, service: 'style-of-life-amazon', vercel: true });
    }

    if (req.method === 'GET' && pathname === '/api/products') {
      const products = await supabase('amazon_products?select=*&active=eq.true&order=created_at.desc');
      return json(res, 200, { products });
    }

    if (pathname === '/api/admin/products' && req.method === 'GET') {
      if (!requireAdmin(req, res)) return;
      const products = await supabase('amazon_products?select=*&order=created_at.desc');
      return json(res, 200, { products });
    }

    if (pathname === '/api/admin/products' && req.method === 'POST') {
      if (!requireAdmin(req, res)) return;
      const b = await body(req);
      const a = parseAmazon(b.amazonUrl);
      if (a.error) return json(res, 400, { error: a.error });
      const row = {
        amazon_url: b.amazonUrl,
        affiliate_url: a.affiliateUrl,
        asin: a.asin,
        title: b.title || 'Amazon Product',
        price: b.price || '',
        image_url: b.imageUrl || '',
        badge: b.badge || 'Style Of Life Pick',
        advantages: Array.isArray(b.advantages) ? b.advantages : [],
        active: b.active !== false
      };
      const data = await supabase('amazon_products', { method: 'POST', body: JSON.stringify(row) });
      return json(res, 201, data[0]);
    }

    const match = pathname.match(/^\/api\/admin\/products\/([^/]+)$/);
    if (match && (req.method === 'PATCH' || req.method === 'DELETE')) {
      if (!requireAdmin(req, res)) return;
      const id = decodeURIComponent(match[1]);
      if (req.method === 'DELETE') {
        await supabase(`amazon_products?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
        return json(res, 200, { ok: true });
      }
      const b = await body(req);
      const row = { updated_at: new Date().toISOString() };
      if (b.active !== undefined) row.active = !!b.active;
      if (b.title !== undefined) row.title = b.title;
      if (b.price !== undefined) row.price = b.price;
      if (b.imageUrl !== undefined) row.image_url = b.imageUrl;
      if (b.badge !== undefined) row.badge = b.badge;
      if (Array.isArray(b.advantages)) row.advantages = b.advantages;
      const data = await supabase(`amazon_products?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(row) });
      return json(res, 200, data[0]);
    }

    return json(res, 404, { error: 'API route not found.' });
  } catch (e) {
    console.error(e);
    return json(res, 500, { error: e.message || 'Server error' });
  }
};
