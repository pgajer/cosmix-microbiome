// On-demand real WebGL/mouse test; no emitted Plotly clicks or numerical fits.
const {chromium}=require('playwright'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
const [origin,file]=process.argv.slice(2);assert(origin&&file,'Pass HTTP origin and population.json');
const layouts=process.argv.includes('--connection-layouts')?JSON.parse(fs.readFileSync(path.join(path.dirname(file),'connection-layouts-3d.json'))).agpConnectionLayouts:null;
global.AgpConnections=require('./agp_connections.js');
const layoutTools=require('./agp_connection_layouts.js');
const data=JSON.parse(fs.readFileSync(file)),connections=require('./agp_connections.js');
const bank=JSON.parse(fs.readFileSync(path.join(path.dirname(file),'pure-1cst-connections.json'))).agpConnections;
const merged=path.join(path.dirname(file),'merged-1cst-connections.json');if(fs.existsSync(merged))bank.merged=JSON.parse(fs.readFileSync(merged)).agpMergedConnections;
(async()=>{
 const b=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']});
 try{
  const p=await b.newPage({viewport:{width:1460,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(origin+'/?dataset=agp-24k-silva');await p.waitForFunction(()=>document.getElementById('graph3d')?._agpClick,{},{timeout:90000});
  if(layouts)await p.selectOption('#agpGraphLayout','graph');
  await p.click('#maximize-featurePanel');await p.waitForFunction(()=>{const g=document.getElementById('graph3d');return Math.abs(g._fullLayout.width-g.clientWidth)<2&&g.clientWidth>800});
  const state=()=>p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('cosmix-agp-view-v1:agp-24k-silva'));return s.graph});
  const ids=()=>p.locator('#samples').evaluate(g=>g.data[0].ids);
  const sampleSnapshot=()=>p.locator('#samples').evaluate(g=>{const t=g.data[0];return {ids:t.ids,x:t.x,y:t.y,z:t.z}});
  // Locate a well-separated visible object using the independent live scene matrices.
  const target=kind=>p.locator('#graph3d').evaluate((g,kind)=>{
   const scene=g._fullLayout.scene._scene,params=scene.glplot.cameraParams,rect=scene.container.getBoundingClientRect();
   const project=point=>{let v=[...point.map((x,i)=>x*scene.dataScale[i]),1];for(const name of ['model','view','projection']){const m=params[name];v=[0,1,2,3].map(j=>v.reduce((sum,x,i)=>sum+m[4*i+j]*x,0))}return {x:rect.left+(v[0]/v[3]+1)*rect.width/2,y:rect.top+(1-v[1]/v[3])*rect.height/2}};
   const t=g.data.find(t=>t.meta?.agpGraphVertices),nodes=t.customdata.map((v,i)=>({...v,...project([t.x[i],t.y[i],t.z[i]])}));
   const inside=p=>p.x>rect.left+35&&p.x<rect.right-35&&p.y>rect.top+35&&p.y<rect.bottom-35;
   const sep=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
   if(kind==='vertex')return nodes.filter(inside).map(n=>({...n,gap:Math.min(...nodes.filter(v=>v.id!==n.id).map(v=>sep(n,v)))})).sort((a,b)=>b.gap-a.gap)[0];
   const edges=g.data.filter(t=>t.meta?.agpGraphEdge).map(t=>({id:t.customdata[0].id,pts:t.x.map((_,i)=>project([t.x[i],t.y[i],t.z[i]]))}));
   const lineDistance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy)};
   const candidates=edges.flatMap(e=>e.pts.slice(5,-5).filter(inside).map(point=>({...point,id:e.id,gap:Math.min(...nodes.map(n=>sep(n,point)),...edges.filter(v=>v.id!==e.id).map(v=>lineDistance(point,v.pts[0],v.pts.at(-1))))})));
   return candidates.sort((a,b)=>b.gap-a.gap)[0];
  },kind);
  const waitSelection=async id=>p.waitForFunction(id=>{const s=JSON.parse(localStorage.getItem('cosmix-agp-view-v1:agp-24k-silva'));return s.graph.history[s.graph.cursor]?.id===id},id);
  const clear=async()=>{await p.click('#graphSummary button');await p.waitForFunction(()=>document.getElementById('sampleTitle').textContent==='American Gut Project')};
  // A held press must not redraw, even when Plotly emits many frame-level picks.
  await p.uncheck('#vertexLabels');const v=await target('vertex');assert(v&&v.gap>12);
  const before=await state();await p.mouse.move(v.x,v.y);await p.mouse.down();
  await new Promise(r=>setTimeout(r,200));assert.deepEqual(await state(),before,'No navigation before release');
  await p.mouse.up();await waitSelection(v.id);assert.equal((await state()).cursor,before.cursor+1);
  await new Promise(r=>setTimeout(r,100));assert.equal((await state()).cursor,before.cursor+1,'Only one history entry per click');await clear();
  for(const q of [70,80,90])for(const method of Object.keys(data.fits))for(const pure of bank.merged?[false,true]:[true])for(const algorithm of layouts?layoutTools.algorithms:['reference']){
   await p.click('#maximize-featurePanel');
   const scheme=data.schemes[q+'%-1-CST'];await p.selectOption('#sampleColorScheme',q+'%-1-CST');await p.selectOption('#sampleMethod',method);
   await p.locator('#stateMode').setChecked(!pure);await p.click('#maximize-featurePanel');
   await p.waitForFunction(()=>{const g=document.getElementById('graph3d');return Math.abs(g._fullLayout.width-g.clientWidth)<2&&g.clientWidth>800});
   await p.locator('#agpConnectionPure').setChecked(pure);
   if(layouts){
    const unchanged=await sampleSnapshot();await p.selectOption('#graphEmbeddingMethod',algorithm);
    const lengths=algorithm==='mds'||algorithm==='weighted_grip'?'connection':'equal';await p.selectOption('#agpConnectionLengths',lengths);
    assert.deepEqual(await sampleSnapshot(),unchanged,'Changing graph method/targets preserves the sample embedding');
    const key=layoutTools.key(q,pure,method,20,'boundary','inclusive',lengths,algorithm),fit=layouts.fits[layouts.contexts[key]];
    const actual=await p.locator('#graph3d').evaluate(g=>{const t=g.data.find(t=>t.meta?.agpGraphVertices);return Object.fromEntries(t.customdata.map((d,i)=>[d.id,[t.x[i],t.y[i],t.z[i]]]))});
    assert.deepEqual(actual,Object.fromEntries(fit.nodes.map((id,i)=>[String(id),fit.coords[i]])));
   }
   const v=await target('vertex');assert(v&&v.gap>12);await p.mouse.click(v.x,v.y);await waitSelection(v.id);
   await p.waitForFunction(()=>document.getElementById('sampleTitle').textContent.includes('Local 3D MDS'));
   assert.deepEqual(await ids(),data.ids.filter((_,i)=>scheme.merged[i]===v.id&&(!pure||scheme.assignment[i]==='core')));
   await clear();const whole=await sampleSnapshot(),edge=await target('edge');assert(edge&&edge.gap>7,'Need an unambiguous edge segment');
   await p.mouse.click(edge.x,edge.y);await waitSelection(edge.id);
   assert((await p.locator('#sampleTitle').textContent()).includes('Boundary:'));
   assert.equal(await p.locator('#agpConnectionPicker').inputValue(),edge.id);
   const expected=connections.edges(bank,scheme,method,20,'boundary','inclusive',pure).find(e=>e.state===edge.id);
   const support=new Set([...expected.ba,...expected.bb].map(i=>data.ids[i]));
   const highlighted=await p.locator('#samples').evaluate(g=>g.data[0].ids.filter((_,i)=>g.data[0].marker.color[i]!=='#dedede'));
   assert.deepEqual(highlighted.sort(),whole.ids.filter(id=>support.has(id)).sort());assert.deepEqual(await sampleSnapshot(),whole);
   await clear();console.log('PASS physical sphere/edge clicks',q,method,pure?'pure':'merged',algorithm);
  }
  // Real rendered labels select their own identities, including with sphere mode off.
  await p.click('#maximize-featurePanel');await p.selectOption('#sampleColorScheme','70%-1-CST');await p.check('#stateMode');
  await p.click('#maximize-featurePanel');await p.waitForFunction(()=>{const g=document.getElementById('graph3d');return Math.abs(g._fullLayout.width-g.clientWidth)<2&&g.clientWidth>800});await p.check('#vertexLabels');
  for(const sphere of [true,false]){
   await p.locator('#graphSpheres').setChecked(sphere);
   const index=await p.locator('#graph3d').evaluate(g=>g.layout.scene.annotations.findIndex(a=>a.name==='agp-vertex:13'));
   const label=p.locator('#graph3d .annotation-scene[data-index="'+index+'"] .annotation-text');const r=await label.boundingBox();assert(r);
   await p.mouse.click(r.x+r.width/2,r.y+r.height/2);await waitSelection('13');assert((await p.locator('#sampleTitle').textContent()).includes('Akkermansia muciniphila'));await clear();
  }
  await p.uncheck('#vertexLabels');const n=await target('vertex');await p.mouse.click(n.x,n.y);await waitSelection(n.id);await clear();
  const nav=await state(),pt=await target('vertex');await p.mouse.move(pt.x,pt.y);await p.mouse.down();await p.mouse.move(pt.x+55,pt.y+30,{steps:8});await p.mouse.up();
  await new Promise(r=>setTimeout(r,80));assert.deepEqual(await state(),nav,'Rotation does not select');
  await p.click('#maximize-featurePanel');await p.check('#graphSpheres');
  await p.waitForFunction(()=>{const g=document.getElementById('graph3d');return Math.abs(g._fullLayout.width-g.clientWidth)<2&&g.clientWidth<800});
  const normalVertex=await target('vertex');assert(normalVertex);await p.mouse.click(normalVertex.x,normalVertex.y);await waitSelection(normalVertex.id);await clear();
  const normalEdge=await target('edge');assert(normalEdge&&normalEdge.gap>5);await p.mouse.click(normalEdge.x,normalEdge.y);await waitSelection(normalEdge.id);await clear();
  await p.check('#vertexLabels');
  await p.locator('#graphVertexCharacteristics > summary').click();await p.getByRole('button',{name:'Akkermansia muciniphila',exact:true}).click();
  await p.waitForFunction(()=>document.getElementById('sampleTitle').textContent.includes('Akkermansia muciniphila'));
  if(layouts){
   for(const kind of ['vertex','edge']){
    if(kind==='edge'){
     await clear();await p.click('#maximize-featurePanel');const edge=await target('edge');
     await p.mouse.click(edge.x,edge.y);await waitSelection(edge.id);
    }
    const before=await state(),points=await sampleSnapshot();
    for(const algorithm of layoutTools.algorithms)for(const lengths of ['equal','connection']){
     await p.selectOption('#graphEmbeddingMethod',algorithm);await p.selectOption('#agpConnectionLengths',lengths);
     const after=await state();assert.deepEqual(after.history,before.history);assert.equal(after.cursor,before.cursor);
     assert.deepEqual(await sampleSnapshot(),points,'Graph layout keeps selected '+kind+' sample coordinates and membership');
    }
   }
   console.log('PASS all four algorithms and both target rules preserve active vertex/edge selections and sample coordinates');
  }
  if(process.env.COSMIX_TEST_SCREENSHOT){await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await p.screenshot({path:process.env.COSMIX_TEST_SCREENSHOT})}
  assert.equal(errors.length,0,errors.join('\n'));console.log('PASS labels, flat vertices, stationary release, rotations, history and synchronized sample views');
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exit(1)});
