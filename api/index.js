const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

try { require("dotenv").config(); } catch (_) {}

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json({ limit: "1mb" }));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AMAZON_PARTNER_TAG = process.env.AMAZON_PARTNER_TAG || "styleoflife08-21";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) return res.status(500).json({ error: "ADMIN_TOKEN is not configured." });
  if (req.headers["x-admin-token"] !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Invalid admin token." });
  }
  next();
}

function requireSupabase(res) {
  if (!supabase) {
    res.status(500).json({ error: "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." });
    return false;
  }
  return true;
}

function extractAsin(input) {
  if (!input || typeof input !== "string") return null;
  const value = input.trim();
  if (/^[A-Z0-9]{10}$/i.test(value)) return value.toUpperCase();

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!["amazon.com","www.amazon.com","smile.amazon.com","amzn.to","amazon.in","www.amazon.in"].includes(host)) return null;

    const parts = url.pathname.split("/").filter(Boolean);
    for (let i = 0; i < parts.length - 1; i++) {
      if (["dp","product","d"].includes(parts[i].toLowerCase()) && /^[A-Z0-9]{10}$/i.test(parts[i+1])) {
        return parts[i+1].toUpperCase();
      }
    }
    return null;
  } catch (_) {
    return null;
  }
}

function affiliateUrl(asin) {
  return `https://www.amazon.com/dp/${encodeURIComponent(asin)}?tag=${encodeURIComponent(AMAZON_PARTNER_TAG)}`;
}

function advantages(value) {
  if (Array.isArray(value)) return value.map(String).map(x => x.trim()).filter(Boolean).slice(0,10);
  if (typeof value === "string") return value.split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0,10);
  return [];
}

app.get("/api/health", (req,res) => res.json({
  ok:true,
  service:"style-of-life-amazon-portal",
  supabaseConfigured:Boolean(supabase)
}));

app.get("/api/products", async (req,res) => {
  if (!requireSupabase(res)) return;
  const {data,error} = await supabase.from("amazon_products").select("*").eq("active",true).order("created_at",{ascending:false});
  if (error) return res.status(500).json({error:error.message});
  res.json({products:(data||[]).sort(()=>Math.random()-0.5)});
});

app.get("/api/admin/products", requireAdmin, async (req,res) => {
  if (!requireSupabase(res)) return;
  const {data,error} = await supabase.from("amazon_products").select("*").order("created_at",{ascending:false});
  if (error) return res.status(500).json({error:error.message});
  res.json({products:data||[]});
});

app.post("/api/admin/products", requireAdmin, async (req,res) => {
  if (!requireSupabase(res)) return;

  const b=req.body||{};
  const asin=extractAsin(b.amazon_url);
  if (!asin) return res.status(400).json({error:"Enter a valid Amazon product URL containing a 10-character ASIN."});

  const row={
    amazon_url:String(b.amazon_url).trim(),
    affiliate_url:affiliateUrl(asin),
    asin,
    title:String(b.title||"Amazon Product").trim(),
    price:b.price?String(b.price).trim():"",
    image_url:b.image_url?String(b.image_url).trim():"",
    badge:String(b.badge||"Style Of Life Pick").trim(),
    advantages:advantages(b.advantages),
    active:b.active!==false
  };

  const {data,error}=await supabase.from("amazon_products").insert(row).select("*").single();
  if(error) return res.status(500).json({error:error.message});
  res.status(201).json({product:data});
});

app.patch("/api/admin/products/:id", requireAdmin, async (req,res) => {
  if (!requireSupabase(res)) return;
  const b=req.body||{}, update={};
  ["title","price","image_url","badge","active"].forEach(k=>{ if(Object.prototype.hasOwnProperty.call(b,k)) update[k]=b[k]; });
  if(Object.prototype.hasOwnProperty.call(b,"advantages")) update.advantages=advantages(b.advantages);
  update.updated_at=new Date().toISOString();

  const {data,error}=await supabase.from("amazon_products").update(update).eq("id",req.params.id).select("*").single();
  if(error) return res.status(500).json({error:error.message});
  res.json({product:data});
});

app.delete("/api/admin/products/:id", requireAdmin, async (req,res) => {
  if (!requireSupabase(res)) return;
  const {error}=await supabase.from("amazon_products").delete().eq("id",req.params.id);
  if(error) return res.status(500).json({error:error.message});
  res.json({ok:true});
});

app.get("/admin",(req,res)=>{
  const file=path.join(__dirname,"..","frontend","admin.html");
  if(!fs.existsSync(file)) return res.status(404).send("Admin page not found.");
  res.sendFile(file);
});

module.exports=app;
