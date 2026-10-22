const express=require("express"),path=require("path");
const app=express(),PORT=process.env.PORT||3000;

// Allow the separately deployed frontend to call this backend.
// For production, set FRONTEND_URL to your exact frontend origin.
const FRONTEND_URL=process.env.FRONTEND_URL||"*";
app.use((req,res,next)=>{
  const origin=req.headers.origin;
  if(FRONTEND_URL==="*" || !origin || origin===FRONTEND_URL){
    res.setHeader("Access-Control-Allow-Origin", FRONTEND_URL==="*" ? "*" : origin);
  }
  res.setHeader("Vary","Origin");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, x-admin-token");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,PATCH,DELETE,OPTIONS");
  if(req.method==="OPTIONS") return res.sendStatus(204);
  next();
});
const SUPABASE_URL=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
const SUPABASE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
const TAG=process.env.AMAZON_PARTNER_TAG||"styleoflife08-21";
const ADMIN_TOKEN=process.env.ADMIN_TOKEN||"";
app.use(express.json({limit:"1mb"}));
app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"public/index.html")));
app.use(express.static(path.join(__dirname,"../frontend")));
function auth(req,res,next){if(!ADMIN_TOKEN||req.headers["x-admin-token"]!==ADMIN_TOKEN)return res.status(401).json({error:"Unauthorized"});next()}
function amazon(raw){try{const u=new URL(String(raw||""));if(!/(^|\.)amazon\./i.test(u.hostname))return null;const m=u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);if(!m)return null;const asin=m[1].toUpperCase();return{asin,affiliateUrl:`https://www.amazon.com/dp/${asin}?tag=${encodeURIComponent(TAG)}`}}catch{return null}}
async function sb(p,o={}){if(!SUPABASE_URL||!SUPABASE_KEY)throw Error("Supabase is not configured");const r=await fetch(`${SUPABASE_URL}/rest/v1/${p}`,{...o,headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,"Content-Type":"application/json",Prefer:"return=representation",...(o.headers||{})}});const t=await r.text();let d;try{d=t?JSON.parse(t):null}catch{d=t}if(!r.ok)throw Error(d?.message||d?.hint||String(d));return d}
app.get("/api/health",(req,res)=>res.json({ok:true,service:"style-of-life-amazon-backend"}));
app.get("/api/products",async(req,res)=>{try{res.json({products:await sb("amazon_products?select=*&active=eq.true&order=created_at.desc")})}catch(e){res.status(500).json({error:e.message})}});
app.get("/api/admin/products",auth,async(req,res)=>{try{res.json({products:await sb("amazon_products?select=*&order=created_at.desc")})}catch(e){res.status(500).json({error:e.message})}});
app.post("/api/admin/products",auth,async(req,res)=>{try{const b=req.body,i=amazon(b.amazonUrl);if(!i)return res.status(400).json({error:"Valid Amazon URL with ASIN required"});const d=await sb("amazon_products",{method:"POST",body:JSON.stringify({amazon_url:b.amazonUrl,affiliate_url:i.affiliateUrl,asin:i.asin,title:b.title||"Amazon Product",price:b.price||"",image_url:b.imageUrl||"",badge:b.badge||"Style Of Life Pick",advantages:Array.isArray(b.advantages)?b.advantages:[],active:b.active!==false})});res.json(d[0])}catch(e){res.status(500).json({error:e.message})}});
app.patch("/api/admin/products/:id",auth,async(req,res)=>{try{const b=req.body,row={};if(b.active!==undefined)row.active=!!b.active;if(b.title!==undefined)row.title=b.title;if(b.price!==undefined)row.price=b.price;if(b.imageUrl!==undefined)row.image_url=b.imageUrl;if(b.badge!==undefined)row.badge=b.badge;if(Array.isArray(b.advantages))row.advantages=b.advantages;row.updated_at=new Date().toISOString();const d=await sb(`amazon_products?id=eq.${encodeURIComponent(req.params.id)}`,{method:"PATCH",body:JSON.stringify(row)});res.json(d[0])}catch(e){res.status(500).json({error:e.message})}});
app.delete("/api/admin/products/:id",auth,async(req,res)=>{try{await sb(`amazon_products?id=eq.${encodeURIComponent(req.params.id)}`,{method:"DELETE"});res.json({ok:true})}catch(e){res.status(500).json({error:e.message})}});
module.exports = app;
