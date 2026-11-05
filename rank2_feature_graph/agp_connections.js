// Saved original-space connections; this module never computes neighbors or fits.
const AgpConnections = (() => {
 const methods=['l1-euclidean','max-euclidean','max-linf'];
 const measures={boundary:'Boundary weight',intensity:'Contact intensity',jaccard:'Expanded Jaccard',paga:'PAGA connectivity'};
 function validate(bank,data){
  if(!bank)return null;
  const fail=()=>{throw Error('AGP connection supplement does not match this population.')};
  if(bank.schema!=='agp-pure-connections-v1'||bank.tiePolicy!=='include-all'||bank.tolerance!==1e-12||
   bank.countSha256!==data.countSha256||bank.featureSha256!==data.featureSha256||bank.neighborPopulation!==data.ids.length||
   bank.sampleIds.length!==data.ids.length||!bank.sampleIds.every((id,i)=>id===data.ids[i]))fail();
  const pure=data.schemes['90%-1-CST'].original.map(Number),counts=new Map();
  if(bank.pureStates.length!==pure.length||!bank.pureStates.every((s,i)=>s===pure[i]))fail();
  pure.forEach(s=>counts.set(s,(counts.get(s)||0)+1));
  if(JSON.stringify([...bank.states].sort((a,b)=>a-b))!==JSON.stringify(data.schemes['90%-1-CST'].cores.map(Number).sort((a,b)=>a-b)))fail();
  for(const method of methods)for(const h of [10,20,40]){
   const view=bank.geometries[method]?.[h],keys=new Set();
   if(!view||view.edges.length!==bank.states.length*(bank.states.length-1)/2)fail();
   for(const e of view.edges){
    const key=e.a+','+e.b;
    if(e.a>=e.b||!bank.states.includes(e.a)||!bank.states.includes(e.b)||keys.has(key))fail();keys.add(key);
    for(const [list,taxon] of [[e.boundaryA,e.a],[e.boundaryB,e.b],[e.twoA,e.a],[e.twoB,e.b]]){
     if(!Array.isArray(list)||list.some((row,i)=>!Number.isInteger(row)||row<0||row>=pure.length||pure[row]!==taxon||(i&&row<=list[i-1])))fail();
    }
    const a=new Set(e.boundaryA),b=new Set(e.boundaryB);
    if(e.twoA.some(i=>!a.has(i))||e.twoB.some(i=>!b.has(i)))fail();
    for(const key of ['intensityA','intensityB','jaccard','paga'])if(!Number.isFinite(e[key])||e[key]<0||e[key]>1)fail();
    if(e.intensityA>e.boundaryA.length/counts.get(e.a)+1e-10||e.intensityB>e.boundaryB.length/counts.get(e.b)+1e-10)fail();
    if(!(e.pagaExpected>0)||Math.abs(e.paga-Math.min(1,e.crossLinks/e.pagaExpected))>1e-10)fail();
    for(const [count,limit] of [[e.knownParticipants,a.size+b.size],[e.twoKnownParticipants,e.twoA.length+e.twoB.length],
     [e.unlinkedRecords,a.size+b.size],[e.twoUnlinkedRecords,e.twoA.length+e.twoB.length]])if(!Number.isInteger(count)||count<0||count>limit)fail();
   }
  }
  return bank;
 }
 function validateMerged(merged,data){
  if(!merged)return null;
  const fail=()=>{throw Error('AGP merged connection supplement does not match this population.')};
  if(merged.schema!=='agp-merged-connections-v1')fail();
  for(const q of [70,80,90]){
   const scheme=data.schemes[q+'%-1-CST'],view=merged.coverages?.[q];
   if(!view||!Array.isArray(view.memberships)||view.memberships.length!==data.ids.length||
    !view.memberships.every((s,i)=>s===Number(scheme.merged[i])))fail();
   // The same structural checks apply, with each coverage's frozen merged labels.
   const proxy={...data,schemes:{'90%-1-CST':{original:scheme.merged,cores:scheme.cores}}};
   validate({...merged,...view,schema:'agp-pure-connections-v1',pureStates:view.memberships},proxy);
  }
  return merged;
 }
 function source(bank,scheme,pure=true){return pure?bank:bank?.merged?.coverages?.[scheme.q]}
 function edges(bank,scheme,method,h,measure='boundary',rule='inclusive',pure=true){
  if(!bank||scheme.k!==1)return [];
  const view=source(bank,scheme,pure);if(!view)return [];
  const keep=new Set(scheme.cores.map(Number)),counts=new Map();
  for(const s of (pure?bank.pureStates:view.memberships))counts.set(s,(counts.get(s)||0)+1);
  return view.geometries[method][h].edges.filter(e=>keep.has(e.a)&&keep.has(e.b)).map(e=>{
   const strict=measure==='boundary'&&rule==='two-only';
   const ba=strict?e.twoA:e.boundaryA,bb=strict?e.twoB:e.boundaryB;
   const fa=ba.length/counts.get(e.a),fb=bb.length/counts.get(e.b);
   const weight={boundary:Math.sqrt(fa*fb),intensity:Math.sqrt(e.intensityA*e.intensityB),jaccard:e.jaccard,paga:e.paga}[measure];
   return {...e,state:e.a+','+e.b,ids:[String(e.a),String(e.b)],connection:true,weight,
    ba,bb,fa,fb,n:ba.length+bb.length,nA:counts.get(e.a),nB:counts.get(e.b),
    participants:strict?e.twoKnownParticipants:e.knownParticipants,unlinked:strict?e.twoUnlinkedRecords:e.unlinkedRecords};
  });
 }
 function filter(edges,minWeight,minSamples){return edges.filter(e=>e.weight>0&&e.weight>=minWeight&&e.ba.length>=minSamples&&e.bb.length>=minSamples)}
 return {validate,validateMerged,source,edges,filter,measures};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=AgpConnections;
