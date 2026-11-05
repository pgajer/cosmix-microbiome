// Display graph geometry only; sample memberships and sample coordinates are immutable.
const AgpConnectionLayouts=(()=>{
 const algorithms=['spring','mds','grip','weighted_grip'];
 function key(q,pure,geometry,h,measure,rule,lengths,algorithm){
  return [q,pure?'pure':'merged',geometry,h,measure,measure==='boundary'?rule:'inclusive',lengths,algorithm].join('/');
 }
 function request(data,references,connections,q,pure,geometry,h,measure,rule,lengths,algorithm){
  const scheme=data.schemes[q+'%-1-CST'],nodes=scheme.cores.map(Number).sort((a,b)=>a-b);
  const rows=new Map(data.ids.map((id,i)=>[id,i]));
  const all=AgpConnections.edges(connections,scheme,geometry,h,measure,rule,pure),max=Math.max(0,...all.map(e=>e.weight));
  const edges=all.filter(e=>e.weight>0).map(e=>[e.a,e.b,lengths==='equal'?1:1+4*(1-e.weight/max)]);
  return {nodes,dimension:3,method:algorithm,edges,
   initial:nodes.map(id=>data.fits[geometry].coordinates[rows.get(references[id].sample)]),context:'agp-1cst-display-v1'};
 }
 function validate(bank,data){
  if(!bank)return null;
  const fail=()=>{throw Error('AGP connection layouts do not match this population.')};
  if(bank.schema!=='agp-connection-layouts-v1'||bank.countSha256!==data.countSha256||bank.featureSha256!==data.featureSha256||bank.targetStrength!==4)fail();
  for(const q of [70,80,90])for(const pure of [false,true])for(const geometry of Object.keys(data.fits))for(const h of [10,20,40])
   for(const measure of Object.keys(AgpConnections.measures))for(const rule of measure==='boundary'?['inclusive','two-only']:['inclusive'])
    for(const lengths of ['equal','connection'])for(const algorithm of algorithms){
     const fit=bank.fits?.[bank.contexts?.[key(q,pure,geometry,h,measure,rule,lengths,algorithm)]];
     const ids=data.schemes[q+'%-1-CST'].cores.map(Number).sort((a,b)=>a-b);
     if(!fit||fit.method!==algorithm||JSON.stringify(fit.nodes)!==JSON.stringify(ids)||fit.coords.length!==ids.length||
      !fit.coords.every(p=>p.length===3&&p.every(Number.isFinite))||!Number.isFinite(fit.rms)||fit.rms<0)fail();
    }
  return bank;
 }
 return {algorithms,key,request,validate};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=AgpConnectionLayouts;
