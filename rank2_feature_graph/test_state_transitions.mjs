import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const c=vm.createContext({participantKey:r=>JSON.stringify([r.cohort,r.subject]),esc:String});
vm.runInContext(fs.readFileSync('rank2_feature_graph/participant_exploration.js','utf8')+'\n'+fs.readFileSync('rank2_feature_graph/state_transitions.js','utf8'),c);
const records=[],metadata={records:{}},assignments=[];
function pair(id,from,to,arm){for(const [stage,state] of [['enrollment_ANC',from],['follow_up_ANC',to]])if(state!=null){const profile=assignments.length,r={id:id+stage,subject:id,cohort:'S',profile,originalVisit:stage};assignments.push(state);records.push(r);metadata.records[r.id]={arm}}}
pair('a','A','A','Azithromycin');pair('b','A','B','Azithromycin');pair('c','A','B','Placebo');pair('d','A',null,'Placebo');pair('e','B','C','Placebo');pair('f',null,'C','Placebo');
const groups=c.explorationIndex(records),m=c.stateTransitionModel([...groups,groups[0]],metadata,assignments),a=m.nodes.find(n=>n.id==='A'),ab=m.edges.find(e=>e.from==='A'&&e.to==='B');
assert.equal(a.enrollment,4);assert.equal(a.origins.Azithromycin,2);assert.equal(a.origins.Placebo,1);assert.equal(ab.percent.Azithromycin,50);assert.equal(ab.percent.Placebo,100);assert.equal(m.excluded.missingVisit,2);assert.equal(m.nodes.find(n=>n.id==='C').enrollment,0);assert.equal(m.nodes.find(n=>n.id==='C').followup,2);
assert.equal(m.edges.find(e=>e.from==='B').percent.Azithromycin,null);
for(const n of m.nodes)for(const arm of ['Azithromycin','Placebo'])if(n.origins[arm])assert.equal(m.edges.filter(e=>e.from===n.id).reduce((sum,e)=>sum+e.percent[arm],0),100);
const labels=new Map(m.nodes.map((n,i)=>[n.id,{key:'S'+i,name:n.id}]));const svg=c.stateTransitionSvg(m,labels);assert.match(svg,/marker-end/);assert.match(svg,/ C /);assert.match(svg,/fill="white" stroke/);assert.doesNotMatch(c.stateTransitionSvg(m,labels,{loops:false}),/ C /);
assert.equal(c.stateTransitionModel([{...groups[0],ambiguous:true}],metadata,assignments).excluded.ambiguous,1);
const bad=structuredClone(metadata);bad.records[groups[0].followup.id].arm='Placebo';assert.equal(c.stateTransitionModel([groups[0]],bad,assignments).excluded.arm,1);
assert.equal(c.stateTransitionModel([groups[0]],metadata,[]).excluded.state,1);
console.log('PASS: one participant once, arm-specific starting-state denominators, missing visits, self-loops, zero-origin states, inconsistent arms and display-only edge filters.');
const fit=c.fitStateTransitions(m,['A','B','C','D']);
assert.equal(fit.arms.Azithromycin[0].cells.find(c=>c.to==='B').probability,.5);
assert.equal(fit.arms.Azithromycin[0].cells.find(c=>c.to==='C').probability,0);
assert.ok(fit.arms.Azithromycin[0].cells.find(c=>c.to==='C').interval[1]>0);
assert.equal(fit.arms.Azithromycin.find(r=>r.from==='D').cells[0].probability,null);
assert.equal(c.transitionWilson(0,0),null);
for(const [k,n,lo,hi] of [[0,10,0,.2775327998628892],[5,10,.236593090512564,.763406909487436],[10,10,.7224672001371107,1]]){
 const ci=c.transitionWilson(k,n);assert.ok(Math.abs(ci[0]-lo)<1e-12);assert.ok(Math.abs(ci[1]-hi)<1e-12);
}
assert.throws(()=>c.fitStateTransitions(m,['A','B']),/catalogue/);
const matrix=c.stateTransitionMatrix(fit,m,labels,'Azithromycin','A');assert.match(matrix,/N=2/);assert.match(matrix,/data-transition-origin="A"/);assert.match(matrix,/no paired starts/);
const csv=c.stateTransitionCsv(fit,labels,60);assert.equal(csv.split('\n').length,1+2*4*4);assert.match(csv,/95% pointwise Wilson/);
console.log('PASS: multinomial MLE, row normalization, unobserved vs unidentified transitions, Wilson reference values, sparse support, accessible matrix and complete CSV.');
const outputIndex=process.argv.indexOf('--fit-output'),output=outputIndex>=0?process.argv[outputIndex+1]:null;
if(output)fs.mkdirSync(output,{recursive:true});
const root='rank2_feature_graph/releases/sante-16s/v1/';
if(fs.existsSync(root+'bundle.json')){
 const b=JSON.parse(fs.readFileSync(root+'bundle.json')),p=JSON.parse(fs.readFileSync(root+'participants.json')),meta=JSON.parse(fs.readFileSync('rank2_feature_graph/participant_exploration.json'));
 for(const [q,merge] of Object.entries(b.cohortAnalysis.merged)){
  const r=c.stateTransitionModel(c.explorationIndex(p.records),meta,merge.pairs);
  assert.equal(r.totals.Azithromycin,156);assert.equal(r.totals.Placebo,160);assert.equal(r.nodes.reduce((s,n)=>s+n.enrollment,0),320);assert.equal(r.nodes.reduce((s,n)=>s+n.followup,0),321);
  assert.equal(r.excluded.missingVisit,9);assert.equal(r.excluded.ambiguous+r.excluded.arm+r.excluded.state,0);
  for(const n of r.nodes)for(const arm of ['Azithromycin','Placebo'])if(n.origins[arm])assert.ok(Math.abs(r.edges.filter(e=>e.from===n.id).reduce((sum,e)=>sum+e.percent[arm],0)-100)<1e-9);
  const fitted=c.fitStateTransitions(r,merge.cores),timing=c.stateTransitionTiming(c.explorationIndex(p.records),meta);
  // Independent reconciliation directly from specimen records (no exploration grouping/count helpers).
  const subjects=new Map();for(const row of p.records){if(!subjects.has(row.subject))subjects.set(row.subject,[]);subjects.get(row.subject).push(row)}
  const counts=new Map();for(const rows of subjects.values()){
   const es=rows.filter(x=>x.originalVisit==='enrollment_ANC'),fs=rows.filter(x=>x.originalVisit==='follow_up_ANC');if(es.length!==1||fs.length!==1)continue;
   const arm=meta.records[es[0].id].arm;assert.equal(meta.records[fs[0].id].arm,arm);
   const key=JSON.stringify([arm,merge.pairs[es[0].profile],merge.pairs[fs[0].profile]]);counts.set(key,(counts.get(key)||0)+1);
  }
  for(const [arm,rows] of Object.entries(fitted.arms))for(const row of rows){
   assert.ok(Math.abs(row.cells.reduce((s,c)=>s+(c.probability||0),0)-(row.total?1:0))<1e-12);
   for(const cell of row.cells){assert.equal(cell.count,counts.get(JSON.stringify([arm,row.from,cell.to]))||0);if(row.total){assert.ok(cell.interval[0]<=cell.probability+1e-12&&cell.interval[1]>=cell.probability-1e-12)}else assert.equal(cell.interval,null)}
  }
  assert.equal(timing.Azithromycin.median,35);assert.equal(timing.Placebo.median,35);assert.equal(timing.Azithromycin.missing+timing.Placebo.missing,7);assert.equal(timing.Azithromycin.nonpositive+timing.Placebo.nonpositive,0);
  if(output){
   const names=new Map(b.data.graphs['100'].edges.map(e=>[e.id,{name:e.label||e.id}]));
   const hashes=Object.fromEntries([root+'bundle.json',root+'participants.json','rank2_feature_graph/participant_exploration.json','rank2_feature_graph/state_transitions.js'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
   fs.writeFileSync(path.join(output,q+'-model.json'),JSON.stringify({coverage:q,datasetRevision:b.dataset?.revision,hashes,totals:r.totals,excluded:r.excluded,timing,fit:fitted}));
   fs.writeFileSync(path.join(output,q+'-model.csv'),c.stateTransitionCsv(fitted,names,q));
  }
  console.log(`SANTE ${q}%: ${r.nodes.length} observed states, ${r.edges.length} transitions, 316 pairs; all outgoing arm percentages reconcile to 100%.`);
 }
}
// Overlapping unions: one A→B woman can stay in one vertex and exit another.
const vg={nodes:[{id:1,label:'shared'},{id:2,label:'A only'},{id:3,label:'B only'},{id:4,label:'C only'}],edges:[{id:'A',from:1,to:2},{id:'B',from:1,to:3},{id:'C',from:3,to:4}]};
const vf=c.fitVertexTransitions(m,['A','B','C'],vg),shared=vf.vertices.find(v=>v.id==='1');
assert.equal(shared.arms.Azithromycin.retention.count,2);assert.equal(shared.arms.Azithromycin.retention.total,2);
assert.equal(shared.arms.Placebo.retention.count,1);assert.equal(shared.arms.Placebo.exit.count,1);
assert.equal(shared.arms.Azithromycin.entry.probability,null);
assert.equal(vf.vertices.find(v=>v.id==='2').arms.Placebo.exit.probability,1);
assert.equal(vf.vertices.find(v=>v.id==='3').arms.Azithromycin.entry.probability,.5);
assert.equal(c.vertexTransitionCsv(vf,60).split('\n').length,1+4*3*2);
assert.match(c.vertexTransitionMatrix(vf),/rows are not distributions/);
if(fs.existsSync(root+'bundle.json')){
 const b=JSON.parse(fs.readFileSync(root+'bundle.json')),p=JSON.parse(fs.readFileSync(root+'participants.json')),meta=JSON.parse(fs.readFileSync('rank2_feature_graph/participant_exploration.json'));
 const women=new Map();for(const r of p.records){const k=JSON.stringify([r.cohort,r.subject]);if(!women.has(k))women.set(k,[]);women.get(k).push(r)}
 for(const [q,merge] of Object.entries(b.cohortAnalysis.merged)){
  const model=c.stateTransitionModel(c.explorationIndex(p.records),meta,merge.pairs),fit=c.fitVertexTransitions(model,merge.cores,b.data.graphs['100']);
  for(const v of fit.vertices)for(const arm of ['Placebo','Azithromycin']){
   let ii=0,io=0,oi=0,oo=0;
   for(const rs of women.values()){const es=rs.filter(r=>r.originalVisit==='enrollment_ANC'),fs=rs.filter(r=>r.originalVisit==='follow_up_ANC');if(es.length!==1||fs.length!==1||meta.records[es[0].id].arm!==arm)continue;
    const member=r=>merge.pairs[r.profile].split(',').includes(v.id),a=member(es[0]),z=member(fs[0]);if(a&&z)ii++;else if(a)io++;else if(z)oi++;else oo++;
   }
   assert.equal(v.arms[arm].retention.count,ii);assert.equal(v.arms[arm].exit.count,io);assert.equal(v.arms[arm].entry.count,oi);
   assert.equal(v.arms[arm].retention.total,ii+io);assert.equal(v.arms[arm].entry.total,oi+oo);
  }
  console.log(`PASS: SANTE ${q}% ${fit.vertices.length} unions independently reconciled from individual specimen memberships.`);
 }
}
// Graph spheres and their labels share the matrix's delegated focus action.
assert.equal((svg.match(/class="transitionStateNode"/g)||[]).length,m.nodes.length);
assert.match(svg,/role="button" tabindex="0" data-transition-origin="A"/);
const focused=c.stateTransitionSvg(m,labels,{focus:'C'});
assert.match(focused,/data-transition-origin="C"[^>]*aria-pressed="true"/);
assert.doesNotMatch(focused,/data-transition-origin="A"/);
assert.doesNotMatch(focused,/<title>A →/);
assert.match(focused,/<title>B → C/);
const focusControl={value:''},zoomControl={value:'200'},zoomOutput={},drawing={style:{}};
let rendered=0,keyboardFocused=0,isMatrix=false;
const target={dataset:{transitionOrigin:'B'},focus:()=>keyboardFocused++};
const plot={style:{setProperty:(key,value)=>{drawing.style[key]=value}},querySelector:()=>({ownerSVGElement:drawing}),querySelectorAll:()=>[target],classList:{contains:()=>isMatrix},getBoundingClientRect:()=>({width:600,height:380})};
c.el=id=>({'stateTransitionFocus':focusControl,'stateTransitionPlot':plot,'stateTransitionZoom':zoomControl,'stateTransitionZoomValue':zoomOutput}[id]);
c.renderStateTransitions=()=>rendered++;
for(const type of ['click','keydown'])c.selectTransitionOrigin({type,target:{closest:()=>target}});
assert.equal(focusControl.value,'B');assert.equal(rendered,2);assert.equal(keyboardFocused,1);
c.selectTransitionOrigin({type:'click',target:{closest:()=>null}});assert.equal(rendered,2);
c.sizeStateTransitionGraph();assert.equal(drawing.style['--transition-zoom'],2);assert.equal(zoomOutput.textContent,'200%');
zoomControl.value='100';c.sizeStateTransitionGraph();assert.equal(drawing.style['--transition-zoom'],1);
isMatrix=true;zoomControl.value='300';c.sizeStateTransitionGraph();assert.equal(drawing.style['--transition-zoom'],1);
console.log('PASS: graph focus markup, incident-edge filtering, click/keyboard parity, focus restoration, complete-drawing zoom and matrix isolation.');
