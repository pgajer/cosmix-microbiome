const {chromium}=require('playwright'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
const [origin,file]=process.argv.slice(2);assert(origin&&file,'Pass HTTP origin and population.json');
const data=JSON.parse(fs.readFileSync(file)),bank=JSON.parse(fs.readFileSync(path.join(path.dirname(file),'pure-1cst-connections.json'))).agpConnections;
(async()=>{
 const browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1460,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin+'/?dataset=agp-24k-silva');await page.waitForSelector('#samples canvas',{timeout:90000});
  await page.selectOption('#sampleColorScheme','90%-1-CST');await page.uncheck('#stateMode');
  await page.waitForFunction(()=>document.getElementById('graph3d').data.some(t=>t.customdata?.[0]?.connection));
  const snapshot=()=>page.locator('#samples').evaluate(g=>{const t=g.data[0];return {ids:t.ids,x:t.x,y:t.y,z:t.z}});
  const changeNumber=async(id,value)=>page.locator('#'+id).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}))},String(value));
  let firstEdge;
  for(const method of Object.keys(data.fits)){
   await page.selectOption('#sampleMethod',method);
   const before=await snapshot(),indices=before.ids.map(id=>data.ids.indexOf(id));
   for(let j=0;j<indices.length;j++)assert.deepEqual([before.x[j],before.y[j],before.z[j]],data.fits[method].coordinates[indices[j]]);
   for(const h of [10,20,40]){
    await page.selectOption('#agpConnectionNeighbors',String(h));
    const key=await page.locator('#agpConnectionPicker option').nth(1).getAttribute('value');assert(key);
    firstEdge=key;await page.selectOption('#agpConnectionPicker',key);
    await page.waitForFunction(()=>document.getElementById('sampleTitle').textContent.includes('Boundary:'));
    const edge=bank.geometries[method][h].edges.find(e=>e.a+','+e.b===key),expected=new Set([...edge.boundaryA,...edge.boundaryB].map(i=>data.ids[i]));
    const colored=await page.locator('#samples').evaluate(g=>{const t=g.data[0];return t.ids.filter((_,i)=>t.marker.color[i]!=='#dedede')});
    assert.equal(errors.length,0,errors.join('\n'));
    assert(JSON.stringify([...colored].sort())===JSON.stringify([...expected].sort()),'Highlighted boundary IDs differ for '+method+' / '+h+' / '+key);
    assert.deepEqual(await snapshot(),before,'A connection changes highlighting, not samples or coordinates');
    const detail=await page.locator('#agpConnectionDescription').textContent();assert(detail.includes(edge.knownParticipants.toLocaleString()+' known participants'));
    await page.click('#headerClearSelection');assert.deepEqual(await snapshot(),before);
   }
  }
  await page.selectOption('#agpConnectionNeighbors','20');
  const original=await snapshot();
  for(const measure of ['boundary','intensity','jaccard','paga']){
   await page.selectOption('#agpConnectionMeasure',measure);assert.equal(await page.locator('#agpConnectionBoundary').isDisabled(),measure!=='boundary');
   assert.deepEqual(await snapshot(),original);
  }
  await page.selectOption('#agpConnectionMeasure','boundary');await page.selectOption('#agpConnectionBoundary','two-only');
  const key=await page.locator('#agpConnectionPicker option').nth(1).getAttribute('value');await page.selectOption('#agpConnectionPicker',key);
  const strict=bank.geometries['max-linf'][20].edges.find(e=>e.a+','+e.b===key),set=new Set([...strict.twoA,...strict.twoB].map(i=>data.ids[i]));
  const marked=await page.locator('#samples').evaluate(g=>g.data[0].ids.filter((_,i)=>g.data[0].marker.color[i]!=='#dedede'));
  assert.deepEqual(marked.sort(),[...set].sort());assert.deepEqual(await snapshot(),original);
  await changeNumber('agpConnectionMinWeight',1);assert.equal(await page.locator('#graph3d').evaluate(g=>g.data.filter(t=>t.mode==='lines').length),0);
  assert.deepEqual(await snapshot(),original);assert((await page.locator('#agpConnectionPicker option:checked').textContent()).includes('hidden by filters'));
  await changeNumber('agpConnectionMinWeight',.05);await changeNumber('agpConnectionMinSamples',10000);
  assert.equal(await page.locator('#graph3d').evaluate(g=>g.data.filter(t=>t.mode==='lines').length),0);
  await changeNumber('agpConnectionMinSamples',5);await page.selectOption('#agpConnectionBoundary','inclusive');
  await page.click('#headerClearSelection');
  const choices=await page.locator('#agpConnectionPicker option').evaluateAll(es=>es.slice(1,3).map(e=>e.value));
  await page.selectOption('#agpConnectionPicker',choices[0]);await page.selectOption('#agpConnectionPicker',choices[1]);
  await page.click('#headerBackSelection');assert.equal(await page.locator('#agpConnectionPicker').inputValue(),choices[0]);
  await page.click('#headerForwardSelection');assert.equal(await page.locator('#agpConnectionPicker').inputValue(),choices[1]);
  await page.selectOption('#agpGraphLayout','reference');await page.waitForFunction(()=>document.getElementById('graph3d').data.some(t=>t.type==='mesh3d'));
  const first=await page.locator('#graph3d').evaluate(g=>{const t=g.data.find(t=>t.type==='mesh3d');return {radius:Math.max(...t.x)-Math.min(...t.x),id:t.meta.graphSphere}});
  await page.locator('#graphVertexScale').evaluate(e=>{e.value=200;e.dispatchEvent(new Event('input',{bubbles:true}))});
  const second=await page.locator('#graph3d').evaluate(g=>{const t=g.data.find(t=>t.type==='mesh3d');return Math.max(...t.x)-Math.min(...t.x)});assert(Math.abs(second/first.radius-2)<1e-7);
  await page.click('#maximize-featurePanel');
  await page.waitForFunction(()=>document.getElementById('featurePanel').classList.contains('agpExpanded'));
  if(process.env.COSMIX_TEST_SCREENSHOT)await page.screenshot({path:process.env.COSMIX_TEST_SCREENSHOT});
  await page.click('#maximize-featurePanel');
  await page.check('#stateMode');assert(await page.locator('#agpConnectionMeasure').isDisabled());assert.equal(await page.locator('#graph3d').evaluate(g=>g.data.filter(t=>t.mode==='lines').length),0);
  await page.selectOption('#sampleColorScheme','40%-2-CST');assert(await page.locator('#agpConnectionControls').isHidden());
  assert.deepEqual(await page.locator('#graph3d').evaluate(g=>g.data.filter(t=>t.mode==='lines').map(t=>t.customdata[0].id)),data.schemes['40%-2-CST'].cores);
  assert.deepEqual(errors,[]);console.log('PASS browser: three geometries/scales, exact boundary highlights, strict rule, filters, all scores, navigation, 3D spheres and merged/pair isolation');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
