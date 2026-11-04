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
 if(refs)await page.locator('#participantShowVertices').check();
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
 await page.getByRole('button',{name:'Clear graph selection'}).click();
 assert.deepEqual(errors,[]);
 await page.selectOption('#datasetSelect','empty');await page.waitForURL('**/empty.html');await page.selectOption('#datasetSelect','agp-24k-silva');await page.waitForSelector('#samples canvas',{timeout:30000});
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
