function json(res, status, data) {
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

function pathOf(req) {
  return (req.url || "/").split("?")[0].replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

async function bodyOf(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return await new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", c => raw += c);
    req.on("end", () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in Vercel Environment Variables.");
  }
  return { url: url.replace(/\/+$/, ""), key };
}

async function supabase(path, options = {}) {
  const { url, key } = config();
  const r = await fetch(url + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: key,
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {})
    }
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    const message = typeof data === "object" && data?.message ? data.message : text || ("Supabase HTTP " + r.status);
    throw Object.assign(new Error(message), { status: r.status });
  }
  return data;
}

function admin(req) {
  const expected = process.env.ADMIN_TOKEN;
  const supplied = req.headers["x-admin-token"];
  if (!expected) throw Object.assign(new Error("ADMIN_TOKEN is missing in Vercel Environment Variables."), {status:500});
  if (!supplied || supplied !== expected) throw Object.assign(new Error("Invalid admin token."), {status:401});
}

module.exports = async (req, res) => {
  cors(res);
  try {
    if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }

    const p = pathOf(req);

    // This route intentionally does NOT touch Supabase.
    if (p === "/api/health") {
      return json(res, 200, {
        ok: true,
        message: "Affiliate API is running",
        node: process.version,
        supabaseConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
        adminConfigured: Boolean(process.env.ADMIN_TOKEN)
      });
    }

    if (p === "/api/products" && req.method === "GET") {
      const data = await supabase("affiliate_products?select=id,title,price,image_url,description,affiliate_url,active,created_at,updated_at&active=eq.true&order=created_at.desc");
      return json(res, 200, {ok:true, products:data || []});
    }

    if (p === "/api/admin/products" && req.method === "GET") {
      admin(req);
      const data = await supabase("affiliate_products?select=*&order=created_at.desc");
      return json(res, 200, {ok:true, products:data || []});
    }

    if (p === "/api/admin/products" && req.method === "POST") {
      admin(req);
      const b = await bodyOf(req);
      const title = String(b.title || "").trim();
      const price = String(b.price || "").trim();
      const image_url = String(b.image_url || "").trim();
      const description = String(b.description || "").trim();
      const affiliate_url = String(b.affiliate_url || "").trim();

      if (!title) return json(res,400,{ok:false,error:"Product Name is required"});
      if (!affiliate_url) return json(res,400,{ok:false,error:"Affiliate Link is required"});

      const row = {
        title,
        price: price || null,
        image_url: image_url || null,
        description: description || null,
        affiliate_url,
        active: true
      };

      const data = await supabase("affiliate_products", {
        method:"POST",
        body:JSON.stringify(row)
      });
      return json(res,201,{ok:true,product:Array.isArray(data)?data[0]:data});
    }

    const m = p.match(/^\/api\/admin\/products\/([^/]+)$/);
    if (m) {
      admin(req);
      const id = encodeURIComponent(decodeURIComponent(m[1]));

      if (req.method === "DELETE") {
        await supabase("affiliate_products?id=eq."+id, {method:"DELETE", prefer:"return=minimal"});
        return json(res,200,{ok:true});
      }

      if (req.method === "PATCH") {
        const b = await bodyOf(req);
        const update = {};
        if (b.title !== undefined) update.title=String(b.title).trim();
        if (b.price !== undefined) update.price=String(b.price).trim()||null;
        if (b.image_url !== undefined) update.image_url=String(b.image_url).trim()||null;
        if (b.description !== undefined) update.description=String(b.description).trim()||null;
        if (b.affiliate_url !== undefined) update.affiliate_url=String(b.affiliate_url).trim();
        if (b.active !== undefined) update.active=Boolean(b.active);
        update.updated_at=new Date().toISOString();

        const data=await supabase("affiliate_products?id=eq."+id,{
          method:"PATCH",
          body:JSON.stringify(update)
        });
        return json(res,200,{ok:true,product:Array.isArray(data)?data[0]:data});
      }
    }

    return json(res,404,{ok:false,error:"API route not found"});
  } catch (e) {
    console.error("AFFILIATE API ERROR", e);
    return json(res, Number(e.status)||500, {ok:false,error:e.message||"Function error"});
  }
};
