// On-demand pure selection/coordinate checks on separately installed v2 apps.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {skinPopulationSelection:select,skinGraphModel,skinGraphLayout}=require('./skin_population_v2.js');
const apps=process.argv.slice(2);assert(apps.length,'Pass installed app folders');
let cases=0;
for(const app of apps){
 const web=path.join(app,'web'),html=fs.readFileSync(path.join(web,'index.html'),'utf8');
 const manifest=JSON.parse(html.match(/<script id="vme-http-manifest" type="application\/json">(.*?)<\/script>/s)[1]);
 for(const [id,entry] of Object.entries(manifest.datasets)){
  if(entry.capability!=='skin-population-v2')continue;
  const parts=entry.parts.map(d=>JSON.parse(fs.readFileSync(path.join(web,d.url))));
  const data={...parts.find(p=>p.skinPopulation).skinPopulation,genusStates:parts.find(p=>p.skinStates)?.skinStates};
  assert(!('counts' in data));assert.equal(data.id,id);
  const byId=new Map(data.records.map(r=>[r.specimenId,r]));
  const participants=[...new Set(data.records.filter(r=>r.participantId!==null).map(r=>r.participantId))];
  const run=s=>{
   const bank=data.genusStates,keep=bank&&s.assignRemaining===false?new Set(bank.sampleIds.filter((id,i)=>bank.levels[String(s.coverage||90)].cores.includes(bank.pure[i]))):null;
   const got=select(data,s),want=data.records.filter(r=>(!s.participant||r.participantId===s.participant)&&(!s.site||JSON.stringify(r.site)===s.site)&&(!s.visit||JSON.stringify(r.visitOrder)===s.visit)&&(!keep||keep.has(r.specimenId)));
   assert.deepEqual(got.subjects,want);
   const ids=new Set(want.map(r=>r.specimenId));
   const expected=s.paths&&s.participant?data.pairs.filter(e=>ids.has(e.from)&&ids.has(e.to)):[];
   assert.deepEqual(got.edges,expected);
   for(const e of got.edges){assert.equal(byId.get(e.from).participantId,byId.get(e.to).participantId);assert.equal(byId.get(e.from).site,byId.get(e.to).site);assert(byId.get(e.from).visitOrder<byId.get(e.to).visitOrder)}
   for(const bank of Object.values(data.banks)){assert.deepEqual(new Set(Object.keys(bank.coordinates)),new Set(byId.keys()));for(const r of want)assert(bank.coordinates[r.specimenId].every(Number.isFinite))}
   cases++;
  };
  run({});assert.equal(select(data,{}).subjects.length,data.records.length);
  if(data.genusStates){
   const snapshot=JSON.stringify(data.banks);
   for(const coverage of [60,70,80,90,100])for(const assignRemaining of [false,true]){
    run({coverage,assignRemaining});assert.equal(select(data,{coverage,assignRemaining}).subjects.length,assignRemaining?data.records.length:data.genusStates.levels[String(coverage)].coreCount);
    for(const participant of participants)run({coverage,assignRemaining,participant,paths:true});
   }
   const annotationSnapshot=JSON.stringify(data.genusStates),layout=skinGraphLayout(data.genusStates);
   assert.deepEqual(skinGraphLayout(data.genusStates),layout,'Deterministic topology layout');assert(Object.values(layout).every(p=>p.every(Number.isFinite)));
   const states=data.genusStates;
   for(const coverage of [60,70,80,90,100])for(const assignRemaining of [false,true]){
    const level=states.levels[String(coverage)],labels=assignRemaining?level.assignments:states.pure;
    const model=skinGraphModel(data,{coverage,assignRemaining});assert.equal(model.edges.length,level.cores.length);
    for(const [kind,items] of [['edge',model.edges],['vertex',model.vertices]])for(const item of items){
     const wanted=data.records.filter((r,i)=>level.cores.includes(labels[i])&&(kind==='edge'?labels[i]===item.id:states.states[labels[i]].components.includes(item.id)));
     const selection={coverage,assignRemaining,graphSelection:{kind,id:item.id}};
     assert.deepEqual(select(data,selection).subjects,wanted);assert.equal(item.reference,wanted.length);assert.equal(item.visible,wanted.length);cases++;
     const participant=wanted.find(r=>r.participantId!==null)?.participantId;
     if(participant){
      const got=select(data,{...selection,participant,paths:true}),expected=wanted.filter(r=>r.participantId===participant),keep=new Set(expected.map(r=>r.specimenId));
      assert.deepEqual(got.subjects,expected);assert.deepEqual(got.edges,data.pairs.filter(e=>keep.has(e.from)&&keep.has(e.to)));cases++;
     }
     if(wanted.length){const r=wanted[0],site=JSON.stringify(r.site),visit=JSON.stringify(r.visitOrder);assert.deepEqual(select(data,{...selection,site,visit}).subjects,wanted.filter(t=>t.site===r.site&&t.visitOrder===r.visitOrder));cases++}
    }
    const first=data.records.find(r=>r.participantId!==null);
    if(first){const context=skinGraphModel(data,{coverage,assignRemaining,participant:first.participantId});for(const edge of context.edges)assert.equal(edge.visible,select(data,{coverage,assignRemaining,participant:first.participantId,graphSelection:{kind:'edge',id:edge.id}}).subjects.length)}
   }
   assert.equal(JSON.stringify(data.genusStates),annotationSnapshot,'Graph never changes assignments');
   assert.equal(JSON.stringify(data.banks),snapshot,'State filtering never changes maps');
  }
  for(const participant of participants){run({participant,paths:true});run({participant,paths:false})}
  for(const site of new Set(data.records.map(r=>r.site)))run({site:JSON.stringify(site)});
  for(const visit of new Set(data.records.map(r=>r.visitOrder)))run({visit:JSON.stringify(visit),participant:participants[0],paths:true});
  if(id==='skin1975-1841')assert.equal(data.records.filter(r=>r.participantId===null).length,414);
  if(id==='skin1975-11052')assert.equal(data.pairs.length,0);
  if(data.studyId==='10894'){assert(data.records.every(r=>r.time.basis==='ordinal'));assert(data.pairs.every(e=>!e.speedEligible&&e.elapsedDays===null));assert(!data.records.some(r=>r.participantId==='HR.20'))}
  console.log('PASS',id,data.records.length,'specimens',data.pairs.length,'vetted edges');
 }
}
console.log('PASS',cases,'membership/filter/geometry checks; browser rendering checked separately');
