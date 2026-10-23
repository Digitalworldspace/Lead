const { createClient } = require("@supabase/supabase-js");

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-admin-token");
}

function getPath(req) {
  return (req.url || "/").split("?")[0].replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  return await new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function requireAdmin(req) {
  const expected = process.env.ADMIN_TOKEN;
  const supplied = req.headers["x-admin-token"];

  if (!expected) {
    throw Object.assign(new Error("Missing ADMIN_TOKEN in Vercel Environment Variables"), { status: 500 });
  }

  if (!supplied || supplied !== expected) {
    throw Object.assign(new Error("Invalid admin token"), { status: 401 });
  }
}

module.exports = async function handler(req, res) {
  cors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  try {
    const path = getPath(req);

    if (path === "/api/health") {
      return send(res, 200, {
        ok: true,
        message: "Affiliate API is running",
        supabaseConfigured: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        adminConfigured: !!process.env.ADMIN_TOKEN
      });
    }

    if (path === "/api/products" && req.method === "GET") {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("affiliate_products")
        .select("id,title,price,image_url,description,affiliate_url,active,created_at,updated_at")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) throw Object.assign(new Error(error.message), { status: 500 });
      return send(res, 200, { ok: true, products: data || [] });
    }

    if (path === "/api/admin/products" && req.method === "GET") {
      requireAdmin(req);
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("affiliate_products")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw Object.assign(new Error(error.message), { status: 500 });
      return send(res, 200, { ok: true, products: data || [] });
    }

    if (path === "/api/admin/products" && req.method === "POST") {
      requireAdmin(req);
      const body = await readBody(req);

      const title = String(body.title || "").trim();
      const price = String(body.price || "").trim();
      const image_url = String(body.image_url || "").trim();
      const description = String(body.description || "").trim();
      const affiliate_url = String(body.affiliate_url || "").trim();
      const active = body.active === false ? false : true;

      if (!title) return send(res, 400, { ok: false, error: "Product Name is required" });
      if (!affiliate_url) return send(res, 400, { ok: false, error: "Affiliate Link is required" });

      try {
        new URL(affiliate_url);
      } catch {
        return send(res, 400, { ok: false, error: "Affiliate Link must be a valid URL" });
      }

      if (image_url) {
        try { new URL(image_url); }
        catch { return send(res, 400, { ok: false, error: "Image URL must be a valid URL" }); }
      }

      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("affiliate_products")
        .insert({
          title,
          price: price || null,
          image_url: image_url || null,
          description: description || null,
          affiliate_url,
          active
        })
        .select("*")
        .single();

      if (error) throw Object.assign(new Error(error.message), { status: 500 });
      return send(res, 201, { ok: true, product: data });
    }

    const match = path.match(/^\/api\/admin\/products\/([^/]+)$/);

    if (match && ["PATCH", "DELETE"].includes(req.method)) {
      requireAdmin(req);
      const id = decodeURIComponent(match[1]);
      const supabase = getSupabase();

      if (req.method === "DELETE") {
        const { error } = await supabase
          .from("affiliate_products")
          .delete()
          .eq("id", id);

        if (error) throw Object.assign(new Error(error.message), { status: 500 });
        return send(res, 200, { ok: true });
      }

      const body = await readBody(req);
      const update = {};

      if (body.title !== undefined) update.title = String(body.title).trim();
      if (body.price !== undefined) update.price = String(body.price).trim() || null;
      if (body.image_url !== undefined) update.image_url = String(body.image_url).trim() || null;
      if (body.description !== undefined) update.description = String(body.description).trim() || null;
      if (body.affiliate_url !== undefined) update.affiliate_url = String(body.affiliate_url).trim();
      if (body.active !== undefined) update.active = !!body.active;
      update.updated_at = new Date().toISOString();

      if (update.title === "") return send(res, 400, { ok: false, error: "Product Name cannot be empty" });

      if (update.affiliate_url) {
        try { new URL(update.affiliate_url); }
        catch { return send(res, 400, { ok: false, error: "Affiliate Link must be a valid URL" }); }
      }

      const { data, error } = await supabase
        .from("affiliate_products")
        .update(update)
        .eq("id", id)
        .select("*")
        .single();

      if (error) throw Object.assign(new Error(error.message), { status: 500 });
      return send(res, 200, { ok: true, product: data });
    }

    return send(res, 404, { ok: false, error: "API route not found" });
  } catch (err) {
    console.error("API ERROR:", err);

    const status = Number(err.status) || 500;
    return send(res, status, {
      ok: false,
      error: err.message || "Server error"
    });
  }
};
