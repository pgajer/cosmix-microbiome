const {chromium}=require('playwright');
const assert=require('node:assert/strict');
// Serve each separately installed fixture first, then pass the EAT and COPSAC ports.
const ports=process.argv.slice(2).map(Number);
assert(ports.length===2&&ports.every(p=>Number.isInteger(p)&&p>0&&p<65536),'Pass EAT and COPSAC loopback ports');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-swiftshader']});
 try{
 for(const [port,name,expected] of [[ports[0],'EAT',[['S1','S2'],['S3','S4']]],[ports[1],'COPSAC',[['S1','S2']]]]){
  const page=await browser.newPage({viewport:{width:1280,height:850}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+port);
  await page.waitForSelector('#samples canvas',{timeout:15000});
  const options=await page.locator('#datasetSelect option').allTextContents();assert.equal(options.length,2);assert(options[1].includes(name));
  const select=(id,value)=>page.locator('#'+id).selectOption(value);
  const capture=()=>page.locator('#samples').evaluate(p=>p.data.map(t=>({mode:t.mode,ids:t.ids,x:t.x,y:t.y,z:t.z})));
  await select('participantSelect','P01');
  for(const method of ['l1-euclidean','max-euclidean','max-linf']){
   await select('sampleMethod',method);
   const traces=await capture();assert.deepEqual(traces.filter(t=>t.mode==='lines').map(t=>t.ids),expected);
   const point=new Map(traces.filter(t=>t.mode==='markers').flatMap(t=>t.ids.map((id,i)=>[id,[t.x[i],t.y[i],t.z[i]]])));
   for(const t of traces.filter(t=>t.mode==='lines')) for(const [i,id] of t.ids.entries()) assert.deepEqual([t.x[i],t.y[i],t.z[i]],point.get(id));
   assert.equal(await page.locator('#participantSelect').inputValue(),'P01');
  }
  await select('skinVisit','1');assert.equal((await capture()).filter(t=>t.mode==='lines').length,0);
  assert((await page.locator('#sampleContext').innerText()).includes(name==='EAT'?'2 specimens':'Earlier collection'));
  await select('skinVisit','');await select('skinSite','forearm');assert.deepEqual((await capture()).filter(t=>t.mode==='lines').map(t=>t.ids),[['S1','S2']]);
  await select('skinSite','');await select('participantSelect','P02');assert.equal((await capture()).filter(t=>t.mode==='lines').length,0);assert((await page.locator('#sampleContext').innerText()).includes('Visit 2'));
  await select('participantSelect','');const download=page.waitForEvent('download');await page.getByText('Export displayed specimens').click();const file=await download;const rows=JSON.parse(require('fs').readFileSync(await file.path()));assert.equal(rows.length,name==='EAT'?5:3);assert(rows.every(r=>r.actualAgeMonths===null));if(name==='COPSAC')assert.deepEqual(rows.find(r=>r.rawAge==='0').studyWindowMonths,[12,36]);
  assert.deepEqual(errors,[]);console.log('PASS',name,options,expected);await page.close();
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1})
