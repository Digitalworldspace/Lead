const {createClient}=require("@supabase/supabase-js");
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
const send=(res,s,d)=>{res.statusCode=s;res.setHeader("Content-Type","application/json");res.end(JSON.stringify(d));};
const admin=req=>req.headers["x-admin-token"]===process.env.ADMIN_TOKEN;
async function body(req){return await new Promise((ok,no)=>{let b="";req.on("data",x=>b+=x);req.on("end",()=>{try{ok(b?JSON.parse(b):{})}catch(e){no(e)}});req.on("error",no)})}
module.exports=async(req,res)=>{
 try{
  res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Headers","Content-Type,x-admin-token");res.setHeader("Access-Control-Allow-Methods","GET,POST,PATCH,DELETE,OPTIONS");
  if(req.method==="OPTIONS")return res.status(204).end();
  const p=new URL(req.url,"http://x").pathname;
  if(p==="/api/health")return send(res,200,{ok:true});
  if(p==="/api/products"&&req.method==="GET"){const{data,error}=await db.from("affiliate_products").select("*").eq("active",true).order("created_at",{ascending:false});return error?send(res,500,{error:error.message}):send(res,200,data||[])}
  if(!admin(req))return send(res,401,{error:"Invalid admin token"});
  if(p==="/api/admin/products"&&req.method==="GET"){const{data,error}=await db.from("affiliate_products").select("*").order("created_at",{ascending:false});return error?send(res,500,{error:error.message}):send(res,200,data||[])}
  if(p==="/api/admin/products"&&req.method==="POST"){const b=await body(req);if(!b.title||!b.affiliate_url)return send(res,400,{error:"Product Name and Affiliate Link are required."});const{data,error}=await db.from("affiliate_products").insert([{title:String(b.title).trim(),price:String(b.price||"").trim(),image_url:String(b.image_url||"").trim(),description:String(b.description||"").trim(),affiliate_url:String(b.affiliate_url).trim(),active:true}]).select().single();return error?send(res,500,{error:error.message}):send(res,200,data)}
  const m=p.match(/^\/api\/admin\/products\/([^/]+)$/);
  if(m&&req.method==="DELETE"){const{error}=await db.from("affiliate_products").delete().eq("id",m[1]);return error?send(res,500,{error:error.message}):send(res,200,{success:true})}
  if(m&&req.method==="PATCH"){const b=await body(req),u={};["title","price","image_url","description","affiliate_url","active"].forEach(k=>{if(b[k]!==undefined)u[k]=b[k]});u.updated_at=new Date().toISOString();const{data,error}=await db.from("affiliate_products").update(u).eq("id",m[1]).select().single();return error?send(res,500,{error:error.message}):send(res,200,data)}
  return send(res,404,{error:"API route not found"});
 }catch(e){return send(res,500,{error:e.message||"Server error"})}
};