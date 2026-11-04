const {chromium}=require('playwright'),assert=require('assert/strict');
const [origin,population]=process.argv.slice(2);
assert(origin&&population,'Pass the loopback origin and the reviewed population.json');
const reference=JSON.parse(require('fs').readFileSync(population));
(async()=>{
 const b=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']});
 try{
 const page=await b.newPage({viewport:{width:1420,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL('/?dataset=agp-24k-silva',origin).href);await page.waitForSelector('#samples canvas',{timeout:60000});
 const header=page.locator('.sampleHeaderActions');
 assert.deepEqual(await header.locator('input, select').evaluateAll(items=>items.map(e=>e.id)),
  ['sampleColorScheme','stateMode','participantShowVertices','sampleMethod']);
 const fs=require('fs'),path=require('path'),refFile=path.join(path.dirname(population),'component-references.json');
 const refs=fs.existsSync(refFile)?JSON.parse(fs.readFileSync(refFile)).agpReferences:null;
 const range=async(id,value)=>page.locator('#'+id).evaluate((c,v)=>{c.value=v;c.dispatchEvent(new Event('input',{bubbles:true}))},value);
 if(refs){
  assert.ok(await page.locator('#sampleReferenceScale').isDisabled());
  await page.check('#participantShowVertices');
  assert.ok(await page.locator('#sampleReferenceSpheres').isChecked());
  const mesh=()=>page.locator('#samples').evaluate(g=>g.data.filter(t=>t.type==='mesh3d').map(t=>{
   const center=['x','y','z'].map(k=>(Math.max(...t[k])+Math.min(...t[k]))/2);
   return {id:t.meta.component,center,width:Math.max(...t.x)-Math.min(...t.x),color:t.color,lighting:t.lighting};
  }));
  for(const [method,fit] of Object.entries(reference.fits)){
   await page.selectOption('#sampleMethod',method);
   const markers=await mesh(),scheme=reference.schemes[await page.locator('#sampleColorScheme').inputValue()];
   assert.deepEqual(markers.map(m=>m.id),[...new Set(scheme.cores.flatMap(state=>state.split(',')))]);
   for(const m of markers){
    const coord=fit.coordinates[reference.ids.indexOf(refs[m.id].sample)];
    assert.ok(m.center.every((v,i)=>Math.abs(v-coord[i])<1e-10));
   }
  }
  const width=(await mesh())[0].width;
  await range('sampleReferenceScale','200');await range('sampleReferenceColor','#148050');
  await range('sampleReferenceSphereAmbient','40');await range('sampleReferenceSphereHighlights','72');
  const marker=(await mesh())[0];
  assert.ok(Math.abs(marker.width/width-2)<1e-8);
  assert.equal(marker.color,'#148050');assert.equal(marker.lighting.ambient,.4);assert.equal(marker.lighting.specular,.72);
  await page.uncheck('#sampleReferenceSpheres');
  assert.ok(await page.locator('#sampleReferenceSphereAmbient').isDisabled());
  assert.equal((await mesh()).length,0);
  assert.deepEqual(await page.locator('#samples').evaluate(g=>g.data[1].marker),{size:10,symbol:'diamond',color:'#148050'});
  console.log('PASS AGP sample reference spheres in all embeddings, size, color, lighting and diamond mode');
 }
 else assert.equal(await page.locator('#participantShowVertices').isDisabled(),true);
 for(const [scheme,s] of Object.entries(reference.schemes)){
  await page.selectOption('#sampleColorScheme',scheme);
  for(const merged of [true,false]){
   await page.locator('#stateMode').setChecked(merged);
   const components=[...new Set(s.cores.flatMap(state=>state.split(',')))];
   const edges=await page.locator('#graph3d').evaluate(g=>g.data.filter(t=>t.mode==='lines').map(t=>t.customdata[0].id));
   assert.deepEqual(edges,s.k===2?s.cores:[]);
   const vertices=await page.locator('#graph3d').evaluate(g=>g.data.find(t=>t.meta?.agpGraphVertices).customdata);
   for(const v of vertices){
    const states=s.cores.filter(state=>state.split(',').includes(v.id));
    assert.equal(v.degree,s.k===2?states.length:0);
    assert.equal(v.n,s.merged.filter((state,i)=>states.includes(state)&&(merged||s.assignment[i]==='core')).length);
   }
   assert.equal(vertices.length,components.length);
   for(const [method,fit] of Object.entries(reference.fits)){
    await page.selectOption('#sampleMethod',method);
    const sample=await page.locator('#samples').evaluate(g=>{const t=g.data[0];return {n:t.ids.length,
      row:[0,Math.floor(t.ids.length/2),t.ids.length-1].map(i=>[t.ids[i],t.x[i],t.y[i],t.z[i],t.customdata[i][0]])}});
    if(refs){
     const anchors=await page.locator('#samples').evaluate(g=>g.data.find(t=>t.meta?.componentReferences));
     assert.deepEqual(anchors.text,components.map(t=>refs[t].label));
     components.forEach((t,j)=>assert.deepEqual([anchors.x[j],anchors.y[j],anchors.z[j]],fit.coordinates[reference.ids.indexOf(refs[t].sample)]));
    }
    const n=merged?24421:s.assignment.filter(v=>v==='core').length;
    assert.equal(sample.n,n);
    for(const [id,x,y,z,label] of sample.row){const i=reference.ids.indexOf(id);assert.deepEqual([x,y,z],fit.coordinates[i]);assert.equal(label,s.labels[s.merged[i]]);if(!merged)assert.equal(s.original[i],s.merged[i])}
   }
  }
  console.log('PASS',scheme);
 }
 const layoutFile=path.join(path.dirname(population),'graph-layouts-3d.json');
 if(fs.existsSync(layoutFile)){
  const bank=JSON.parse(fs.readFileSync(layoutFile)).agpGraphLayouts;
  assert.equal(await page.locator('#agpGraphLayout').inputValue(),'graph');
  const verifyLayout=async fit=>{
   const trace=await page.locator('#graph3d').evaluate(g=>g.data.find(t=>t.meta?.agpGraphVertices));
   trace.customdata.forEach((v,i)=>assert.deepEqual([trace.x[i],trace.y[i],trace.z[i]],fit.coords[bank.nodes.indexOf(+v.id)]));
  };
  for(const merged of [false,true]){
   await page.locator('#stateMode').setChecked(merged);
   for(const length of ['reference','equal','proportion']){
    await page.selectOption('#graphEdgeLengths',length);
    if(length==='reference'){await verifyLayout(bank.reference);continue}
    for(const method of ['spring','mds','grip','weighted_grip']){
     await page.selectOption('#graphEmbeddingMethod',method);
     await verifyLayout(bank.fits[length==='equal'?'equal/0/'+method:(merged?'merged':'pure')+'/16/'+method]);
    }
   }
  }
  await range('graphProportionStrength','10');await verifyLayout(bank.fits['merged/40/weighted_grip']);
  const mesh=()=>page.locator('#graph3d').evaluate(g=>{const t=g.data.find(t=>t.type==='mesh3d');return t&&{radius:Math.max(...t.x)-Math.min(...t.x),color:t.color,lighting:t.lighting}});
  const start=await mesh();assert.ok(start.radius>0);
  await range('graphVertexScale','200');assert.ok(Math.abs((await mesh()).radius/start.radius-2)<1e-8);
  await range('graphVertexColor','#cc6688');await range('graphSphereAmbient','42');await range('graphSphereHighlights','68');
  const after=await mesh();assert.equal(after.color,'#cc6688');assert.equal(after.lighting.ambient,.42);assert.equal(after.lighting.specular,.68);
  await page.uncheck('#graphSpheres');assert.equal(await mesh(),undefined);assert.ok(await page.locator('#graphSphereAmbient').isDisabled());
  await page.check('#graphSpheres');assert.deepEqual(await mesh(),after);
  console.log('PASS AGP 3D graph fits, target strengths, mesh size, color, lighting and flat-marker toggle');
 }

 if(refs){
  await page.selectOption('#agpGraphLayout','reference');
  await page.waitForFunction(()=>document.getElementById('graph3d').data.at(-1).type==='scatter3d');
  const nodes=await page.locator('#graph3d').evaluate(g=>g.data.at(-1));
  nodes.customdata.forEach((v,i)=>assert.deepEqual([nodes.x[i],nodes.y[i],nodes.z[i]],reference.fits['max-linf'].coordinates[reference.ids.indexOf(refs[v.id].sample)]));
  await page.uncheck('#participantShowVertices');
  assert.equal(await page.locator('#samples').evaluate(g=>g.data.length),1);
 }
 await page.check('#graphDegreeFilter');
 assert.ok(await page.locator('#graph3d').evaluate(g=>g.data.at(-1).customdata.every(v=>v.degree>=2)));
 await page.click('#maximize-featurePanel');
 assert.equal(await page.locator('#maximize-featurePanel').getAttribute('aria-expanded'),'true');
 await page.click('#maximize-featurePanel');
 await page.click('#graphVertexCharacteristics summary');
 await page.locator('#graphVertexRows button').first().click();
 assert.ok(await page.locator('#samples').evaluate(g=>g.data[0].marker.color.includes('#dedede')));
 const sampleColors=()=>page.locator('#samples').evaluate(g=>g.data[0].marker.color.join(','));
 const first=await sampleColors();
 await page.locator('#graphVertexRows button').nth(1).click();const second=await sampleColors();assert.notEqual(first,second);
 await page.click('#headerBackSelection');assert.equal(await sampleColors(),first);
 await page.click('#headerForwardSelection');assert.equal(await sampleColors(),second);
 await page.click('#headerClearSelection');assert.ok(!(await sampleColors()).includes('#dedede'));
 await page.click('#headerBackSelection');assert.equal(await sampleColors(),second);
 await page.locator('#graphVertexRows button').first().click();assert.ok(await page.locator('#headerForwardSelection').isDisabled());
 await page.getByRole('button',{name:'Clear graph selection'}).click();
 await page.selectOption('#sampleColorScheme',{index:0});assert.ok(await page.locator('#headerBackSelection').isDisabled());
 if(refs){await page.check('#participantShowVertices');await page.check('#sampleReferenceSpheres')}
 await page.click('#saveSampleView');
 await page.locator('#viewExportDownload').waitFor({state:'visible',timeout:60000});
 await page.check('#viewExportInfo');await page.selectOption('#viewExportScale','2');
 await page.locator('#viewExportDownload[download$="-2x.png"]').waitFor({state:'visible',timeout:60000});
 const [download]=await Promise.all([page.waitForEvent('download'),page.click('#viewExportDownload')]);
 const png=fs.readFileSync(await download.path());
 assert.equal(png.subarray(1,4).toString(),'PNG');assert.ok(png.readUInt32BE(16)>600);
 await page.click('#viewExportClose');
 console.log('PASS AGP selection navigation, history reset, and PNG download with legend at 2×');
 const localPath=path.join(path.dirname(population),'local-1cst-pilot.json');
 const reviewedPath=path.join(path.dirname(population),'local-1cst-through-5006.json');
 const fullPath=fs.existsSync(reviewedPath)?reviewedPath:path.join(path.dirname(population),'local-1cst-all.json');
 if(fs.existsSync(fullPath)||fs.existsSync(localPath)){
  const bank=fs.existsSync(fullPath)?JSON.parse(fs.readFileSync(fullPath)).agpLocalBank:null;
  const fits=bank?Object.fromEntries(Object.entries(bank.views).map(([key,cell])=>[key,bank.fits[cell]])):JSON.parse(fs.readFileSync(localPath)).agpLocalFits;
  if(bank){
   assert.equal(Object.keys(fits).length,372);assert.equal(Object.keys(bank.fits).length,216);
   for(const [scheme,s] of Object.entries(reference.schemes).filter(([,s])=>s.k===1)){
    for(const id of s.cores)for(const mode of ['pure','merged']){
     const expected=s.merged.flatMap((t,i)=>t===id&&(mode==='merged'||s.assignment[i]==='core')?[i]:[]);
     for(const method of Object.keys(reference.fits)){
      const fit=fits[[scheme,id,mode,method].join('/')];
      if(fs.existsSync(reviewedPath))assert.equal(fit.metrics.evaluationRule==='all-pairs',expected.length<=5006);
      assert.deepEqual(fit.indices,expected);assert.equal(fit.coordinates.length,expected.length);
     }
    }
   }
  }
  const cases=bank?[[70,'51'],[70,'146'],[80,'268'],[90,'299']]:[[70,'51'],[70,'13']];
  for(const [q,id] of cases){
   const scheme=q+'%-1-CST',name=reference.schemes[scheme].labels[id];
   await page.selectOption('#sampleColorScheme',scheme);
   await page.selectOption('#agpGraphLayout','diagram');
   const vertexIndex=await page.locator('#graph3d').evaluate((g,taxon)=>g.data.find(t=>t.meta?.agpGraphVertices).customdata.findIndex(v=>v.id===taxon),id);
   const point=page.locator('#graph3d .scatterlayer .point').nth(vertexIndex);
   await point.scrollIntoViewIfNeeded();
   const bounds=await point.boundingBox();
   await page.mouse.click(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
   await page.waitForFunction(()=>document.getElementById('sampleTitle').textContent.includes('Local 3D MDS'));
   for(const mode of ['pure','merged']){
    await page.locator('#stateMode').setChecked(mode==='merged');
    for(const method of Object.keys(reference.fits)){
     await page.selectOption('#sampleMethod',method);
     const fit=fits[[scheme,id,mode,method].join('/')];
     const rendered=await page.locator('#samples').evaluate(g=>{const t=g.data[0];return {ids:t.ids,
      pos:[0,t.ids.length-1].map(i=>[t.x[i],t.y[i],t.z[i]]),labels:g.layout.scene.annotations.map(a=>a.text)}});
     assert.deepEqual(rendered.ids,fit.indices.map(i=>reference.ids[i]));
     assert.deepEqual(rendered.pos,[fit.coordinates[0],fit.coordinates.at(-1)]);
     if(refs)assert.deepEqual(rendered.labels,rendered.ids.includes(refs[id].sample)?[name]:[]);
     assert.ok((await page.locator('#sampleTitle').innerText()).includes(name+' · Local 3D MDS'));
     const full=fit.metrics.evaluationRule==='all-pairs',status=await page.locator('#sampleStress').innerText();
     assert.ok(status.includes(fit.metrics.localError.toFixed(2)+'% ('+(full?'all pairs':'held-out pairs')+')'));
     if(full)assert.ok(await page.getByText('Full metric-MDS fitted all '+fit.metrics.pairs.toLocaleString()+' pairs',{exact:false}).count());
    }
   }
   await page.click('#headerClearSelection');
   assert.equal(await page.locator('#samples').evaluate(g=>g.data[0].ids.length),reference.ids.length);
  }
  console.log('PASS local 1-CST bank, plot coordinates, pure/merged membership, reference labels, errors and population return');
 }
 assert.deepEqual(errors,[]);
 await page.selectOption('#datasetSelect','empty');await page.waitForURL('**/empty.html');await page.selectOption('#datasetSelect','agp-24k-silva');await page.waitForSelector('#samples canvas',{timeout:30000});
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
