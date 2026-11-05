// On demand: use an isolated browser context, never a user's saved preferences.
const {chromium}=require('playwright'),assert=require('assert/strict');
const [origin]=process.argv.slice(2);assert(origin,'Pass the loopback origin of a built app with AGP local/unfolded/connection assets');
const key='cosmix-agp-view-v1:agp-24k-silva',url=origin+'/?dataset=agp-24k-silva';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({viewport:{width:1500,height:1000}}),errors=[];
  context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  let page=await context.newPage();
  const ready=()=>page.waitForFunction(()=>document.getElementById('samples')?._agpRememberView&&document.getElementById('graph3d')?._agpClick,{},{timeout:90000});
  const change=async(id,value,event='input')=>page.locator('#'+id).evaluate((e,{value,event})=>{e.value=String(value);e.dispatchEvent(new Event(event,{bubbles:true}))},{value,event});
  const saved=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  const snapshot=()=>page.evaluate(()=>{
   const el=id=>document.getElementById(id),p=el('samples'),g=el('graph3d');
   return {title:el('sampleTitle').textContent,ids:p.data[0].ids,xyz:[p.data[0].x,p.data[0].y,p.data[0].z],
    selection:el('headerClearSelection').disabled,back:el('headerBackSelection').disabled,forward:el('headerForwardSelection').disabled,
    sampleCamera:p._fullLayout.scene._scene.getCamera(),graphCamera:g._fullLayout.scene?._scene.getCamera(),
    graphRanges:g._fullLayout.scene?null:{x:g._fullLayout.xaxis.range,y:g._fullLayout.yaxis.range},
    layout:el('agpGraphLayout').value,connection:el('agpConnectionPicker').value,
    expanded:el('samplePanel').classList.contains('agpExpanded'),collapsed:el('explorerLayout').classList.contains('controlsCollapsed'),
    details:['sampleAppearance','sampleAppearanceVertices','graphVertexCharacteristics','agpEmbeddingDetails'].map(id=>[id,el(id).open]),
    controls:Object.fromEntries([...document.querySelectorAll('#samplePanel input,#samplePanel select,#featurePanel input,#featurePanel select')].filter(e=>e.id).map(e=>[e.id,e.type==='checkbox'?e.checked:e.value]))};
  });
  const compare=(before,after)=>{
   for(const camera of ['sampleCamera','graphCamera']){
    if(before[camera])for(const v of ['eye','center','up'])for(const axis of ['x','y','z'])assert(Math.abs(before[camera][v][axis]-after[camera][v][axis])<1e-8,camera+' '+v+' '+axis);
    delete before[camera];delete after[camera];
   }
   assert.deepEqual(after,before);
  };
  await page.goto(url);await ready();
  await page.selectOption('#sampleColorScheme','90%-1-CST');await page.selectOption('#sampleMethod','max-euclidean');
  await page.uncheck('#stateMode');await page.check('#participantShowVertices');
  await page.locator('#graphVertexCharacteristics > summary').click();
  await page.getByRole('button',{name:'Akkermansia muciniphila',exact:true}).click();
  await page.getByRole('button',{name:'Bacteroides dorei',exact:true}).click();
  await page.click('#headerBackSelection');await page.check('#unfoldFaces');
  await page.check('#agpConnectionPure');
  await page.selectOption('#agpGraphLayout','reference');
  if(process.argv.includes('--connection-layouts')){
   await page.selectOption('#agpGraphLayout','graph');await page.selectOption('#graphEmbeddingMethod','grip');
   await page.selectOption('#agpConnectionLengths','connection');
  }
  for(const [id,value] of Object.entries({sampleReferenceScale:180,sampleReferenceColor:'#148050',sampleReferenceSphereAmbient:42,
   sampleReferenceSphereHighlights:65,participantVertexLabelSize:17,graphVertexScale:165,graphVertexColor:'#cc6688',
   graphEdgeColor:'#226677',graphEdgeWidth:8,graphWidthStrength:.65,graphFadeStrength:.17,graphSphereAmbient:39,graphSphereHighlights:61}))await change(id,value);
  await page.selectOption('#agpConnectionNeighbors','40');await page.selectOption('#agpConnectionBoundary','two-only');
  await change('agpConnectionMinWeight',.03,'change');await change('agpConnectionMinSamples',3,'change');
  await page.check('#graphDegreeFilter');await change('graphMinimumDegree',1);
  await page.locator('#agpEmbeddingDetails > summary').click();
  await page.evaluate(async()=>{
   await Plotly.relayout('samples',{'scene.camera':{eye:{x:1.8,y:-.7,z:.6},center:{x:.1,y:0,z:0},up:{x:0,y:0,z:1}}});
   await Plotly.relayout('graph3d',{'scene.camera':{eye:{x:-1.7,y:.8,z:1.1},center:{x:0,y:.2,z:0},up:{x:0,y:0,z:1}}});
  });
  await page.click('#toggleControls');await page.click('#maximize-samplePanel');
  const local=await snapshot(),prefs=await saved();
  assert(local.title.includes('Akkermansia muciniphila')&&local.title.includes('Unfolded faces'));
  assert.equal(local.forward,false);assert(prefs.views&&Object.keys(prefs.views).length>=2);
  await page.reload();await ready();compare(structuredClone(local),await snapshot());
  assert.deepEqual((await saved()).graph,prefs.graph);
  if(process.env.COSMIX_TEST_SCREENSHOT)await page.screenshot({path:process.env.COSMIX_TEST_SCREENSHOT});
  console.log('PASS local/unfolded state, controls, both cameras, panel state and Back/Forward survive reload');
  await page.click('#headerForwardSelection');assert((await page.locator('#sampleTitle').textContent()).includes('Bacteroides dorei'));
  await page.click('#headerBackSelection');assert((await page.locator('#sampleTitle').textContent()).includes('Akkermansia muciniphila'));
  await page.click('#maximize-samplePanel');await page.click('#toggleControls');await page.click('#headerClearSelection');
  await page.check('#stateMode');await page.selectOption('#agpGraphLayout','diagram');
  await page.selectOption('#agpConnectionBoundary','inclusive');await page.selectOption('#agpConnectionMeasure','intensity');
  const edge=await page.locator('#agpConnectionPicker option').nth(1).getAttribute('value');
  await page.selectOption('#agpConnectionPicker',edge);
  await page.evaluate(()=>Plotly.relayout('graph3d',{'xaxis.range':[-.4,.7],'yaxis.range':[-25,1]}));
  const boundary=await snapshot();assert(boundary.title.includes('Boundary:'));
  await page.reload();await ready();compare(structuredClone(boundary),await snapshot());
  await page.close();page=await context.newPage();await page.goto(url);await ready();compare(structuredClone(boundary),await snapshot());
  console.log('PASS selected connection, weights, 2D zoom and sample highlighting survive reload and reopening a tab');
  await page.selectOption('#datasetSelect','comb-V3V4-tx');
  await page.waitForFunction(()=>document.getElementById('samples')?.data?.length&&document.getElementById('datasetSelect').value==='comb-V3V4-tx');
  assert.equal(await page.locator('#sampleColorScheme option[value="90%-1-CST"]').count(),0,'AGP settings must not leak to comb');
  await page.selectOption('#datasetSelect','agp-24k-silva');await ready();compare(structuredClone(boundary),await snapshot());
  console.log('PASS switching to comb-V3V4-tx and back restores AGP independently');
  await page.selectOption('#sampleColorScheme','40%-2-CST');await page.selectOption('#agpGraphLayout','graph');
  await page.selectOption('#graphEdgeLengths','equal');await page.selectOption('#graphEmbeddingMethod','spring');
  const pair=await page.locator('#graphVertexRows button').first();await pair.click();
  const pairs=await snapshot();await page.reload();await ready();compare(structuredClone(pairs),await snapshot());
  await page.selectOption('#graphEdgeLengths','reference');
  await page.reload();await ready();assert.equal(await page.locator('#graphEdgeLengths').inputValue(),'reference');
  await page.selectOption('#graphEdgeLengths','equal');assert.equal(await page.locator('#graphEmbeddingMethod').inputValue(),'spring');
  console.log('PASS pair-graph layout, vertex selection and preceding fit method survive reload');
  // Modify stored data from a neutral page, after AGP has flushed its exit state.
  await page.goto(origin+'/empty.html');
  await page.evaluate(k=>{const value=JSON.parse(localStorage.getItem(k));value.controls.sampleColorScheme='missing';value.controls.sampleMethod='missing';
   value.controls.graphVertexScale='bad';value.controls.stateMode='false';value.graph={history:[{id:'missing',edge:false}],cursor:0};
   value.views={'samples/l1-euclidean':{camera:{eye:{x:'bad'}}}};localStorage.setItem(k,JSON.stringify(value))},key);
  await page.goto(url);await ready();assert.equal(await page.locator('#sampleColorScheme').inputValue(),'70%-1-CST');
  assert.equal(await page.locator('#sampleMethod').inputValue(),'l1-euclidean');assert(await page.locator('#headerClearSelection').isDisabled());
  assert.equal(await page.locator('#graphVertexScale').inputValue(),'100');assert(await page.locator('#stateMode').isChecked());
  await page.goto(origin+'/empty.html');await page.evaluate(k=>localStorage.setItem(k,'not JSON'),key);await page.goto(url);await ready();
  assert.equal(await page.locator('#sampleColorScheme').inputValue(),'70%-1-CST');assert.equal(errors.length,0,errors.join('\n'));
  const blocked=await browser.newContext();await blocked.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('Storage unavailable')};Storage.prototype.setItem=()=>{throw Error('Storage unavailable')}});
  const noStorage=await blocked.newPage();noStorage.on('pageerror',e=>errors.push(e.message));await noStorage.goto(url);
  await noStorage.waitForFunction(()=>document.getElementById('graph3d')?._agpClick,{},{timeout:90000});
  assert.equal(errors.length,0,errors.join('\n'));await blocked.close();
  console.log('PASS invalid or unavailable browser storage falls back safely; no scientific assets changed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
