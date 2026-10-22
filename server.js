const express=require("express");
const path=require("path");

const app=express();
const PORT=process.env.PORT||3000;
const SUPABASE_URL=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
const SUPABASE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||"";
const TAG=process.env.AMAZON_PARTNER_TAG||"styleoflife08-21";
const ADMIN_TOKEN=process.env.ADMIN_TOKEN||"";

app.use(express.json({limit:"1mb"}));
app.use(express.static(path.join(__dirname,"public")));

function requireAdmin(req,res,next){
  if(!ADMIN_TOKEN) return res.status(500).json({error:"ADMIN_TOKEN is not configured."});
  const token=req.headers["x-admin-token"];
  if(token!==ADMIN_TOKEN) return res.status(401).json({error:"Unauthorized"});
  next();
}

function amazonInfo(raw){
  try{
    const u=new URL(String(raw||"").trim());
    if(!/(^|\.)amazon\./i.test(u.hostname)) return null;
    const m=u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})/i);
    if(!m) return null;
    const asin=m[1].toUpperCase();
    return {
      asin,
      affiliateUrl:`https://www.amazon.com/dp/${asin}?tag=${encodeURIComponent(TAG)}`
    };
  }catch{return null}
}

async function sb(pathname,options={}){
  if(!SUPABASE_URL||!SUPABASE_KEY) throw new Error("Supabase environment variables are missing.");
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`,{
    ...options,
    headers:{
      apikey:SUPABASE_KEY,
      Authorization:`Bearer ${SUPABASE_KEY}`,
      "Content-Type":"application/json",
      Prefer:"return=representation",
      ...(options.headers||{})
    }
  });
  const text=await r.text();
  let data; try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok) throw new Error(typeof data==="object" ? (data.message||data.hint||JSON.stringify(data)) : data);
  return data;
}

app.get("/api/products",async(req,res)=>{
  try{
    const active=req.query.admin==="1" ? "" : "&active=eq.true";
    const rows=await sb(`amazon_products?select=*&order=created_at.desc${active}`);
    res.json({products:rows});
  }catch(e){res.status(500).json({error:e.message})}
});

app.post("/api/products",requireAdmin,async(req,res)=>{
  try{
    const b=req.body||{}, info=amazonInfo(b.amazonUrl);
    if(!info) return res.status(400).json({error:"Enter a valid Amazon URL such as https://www.amazon.com/dp/ASIN"});
    const row={
      amazon_url:String(b.amazonUrl).trim(),
      affiliate_url:info.affiliateUrl,
      asin:info.asin,
      title:String(b.title||"Amazon Product").trim(),
      price:String(b.price||"See price on Amazon").trim(),
      image_url:String(b.imageUrl||"").trim(),
      badge:String(b.badge||"Style Of Life Pick").trim(),
      advantages:Array.isArray(b.advantages)?b.advantages.filter(Boolean).slice(0,8):[],
      active:b.active!==false
    };
    const data=await sb("amazon_products",{method:"POST",body:JSON.stringify(row)});
    res.json(data[0]);
  }catch(e){res.status(500).json({error:e.message})}
});

app.patch("/api/products/:id",requireAdmin,async(req,res)=>{
  try{
    const b=req.body||{}, row={};
    if(b.amazonUrl!==undefined){
      const info=amazonInfo(b.amazonUrl);
      if(!info)return res.status(400).json({error:"Invalid Amazon URL"});
      row.amazon_url=String(b.amazonUrl).trim(); row.affiliate_url=info.affiliateUrl; row.asin=info.asin;
    }
    for(const [a,k] of [["title","title"],["price","price"],["imageUrl","image_url"],["badge","badge"]])
      if(b[a]!==undefined)row[k]=String(b[a]);
    if(Array.isArray(b.advantages))row.advantages=b.advantages.filter(Boolean).slice(0,8);
    if(b.active!==undefined)row.active=Boolean(b.active);
    row.updated_at=new Date().toISOString();
    const data=await sb(`amazon_products?id=eq.${encodeURIComponent(req.params.id)}`,{method:"PATCH",body:JSON.stringify(row)});
    if(!data.length)return res.status(404).json({error:"Product not found"});
    res.json(data[0]);
  }catch(e){res.status(500).json({error:e.message})}
});

app.delete("/api/products/:id",requireAdmin,async(req,res)=>{
  try{
    await sb(`amazon_products?id=eq.${encodeURIComponent(req.params.id)}`,{method:"DELETE"});
    res.json({ok:true});
  }catch(e){res.status(500).json({error:e.message})}
});

app.get("/api/health",async(req,res)=>{
  res.json({ok:true,supabaseConfigured:Boolean(SUPABASE_URL&&SUPABASE_KEY),amazonTag:TAG});
});

app.listen(PORT,()=>console.log(`Style Of Life Amazon backend on ${PORT}`));
