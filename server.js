const express=require("express");
const path=require("path");
const leads=require("./leads.json");
const app=express();
app.use(express.static(path.join(__dirname,"public")));

function score(l){
  let s=0, reasons=[];
  if(l.jewelry) {s+=20; reasons.push("Jewelry is part of the business");}
  if(l.activeCatalog) {s+=20; reasons.push("Active jewelry catalog/collection");}
  if(l.newCollection) {s+=15; reasons.push("Recent/new collection signal");}
  if(l.wholesale) {s+=15; reasons.push("Wholesale/retail opportunity");}
  if(l.recentActivity) {s+=10; reasons.push("Recent business activity");}
  if(l.decisionMaker) {s+=10; reasons.push("Decision-maker identified");}
  if(l.websiteActive) {s+=10; reasons.push("Active website/social presence");}
  s=Math.min(100,s);
  return {...l,score:s,priority:s>=80?"HIGH POTENTIAL":s>=60?"MEDIUM":"SKIP",reasons};
}
app.get("/api/leads",(req,res)=>{
  const q=(req.query.q||"").toLowerCase();
  const location=(req.query.location||"").toLowerCase();
  const out=leads.filter(l=>
    (!location || l.location.toLowerCase().includes(location) || location==="usa") &&
    (!q || (l.name+" "+l.category+" "+l.location).toLowerCase().includes(q.split(" ")[0]))
  ).map(score).sort((a,b)=>b.score-a.score);
  res.json({leads:out});
});
const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log(`Lead Finder running on http://localhost:${PORT}`));
