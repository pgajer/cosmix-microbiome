// On demand only. Exercises real HTTP/Plotly assets; never fits a model.
const {chromium}=require('playwright'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
const [origin,folder]=process.argv.slice(2);assert(origin&&folder,'Pass HTTP origin and supplied outcome directory');
const bank=JSON.parse(fs.readFileSync(path.join(folder,'outcome-estimates.json'))).agpOutcomeEstimates;
const population=JSON.parse(fs.readFileSync(path.join(folder,'population.json'))),rows=new Map(bank.sample.map((id,i)=>[id,i]));
(async()=>{
 const browser=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1580,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const ready=()=>page.waitForFunction(()=>document.getElementById('graph3d')?._agpClick&&document.getElementById('samples')?._agpRememberView,{},{timeout:90000});
  await page.goto(origin+'/?dataset=agp-24k-silva');await ready();
  const snapshot=()=>page.locator('#samples').evaluate(p=>p.data.filter(t=>t.meta?.agpSamples).flatMap(t=>t.ids.map((id,i)=>[id,t.x[i],t.y[i],t.z[i]])).sort((a,b)=>a[0].localeCompare(b[0])));
  const graph=()=>page.locator('#graph3d').evaluate(p=>JSON.stringify(p.data.map(t=>({x:t.x,y:t.y,z:t.z,customdata:t.customdata}))));
  const check=async()=>{
   const key=await page.evaluate(()=>['agpOutcomePolicy','agpOutcome','agpOutcomeMethod','agpOutcomeScope','agpOutcomeKind'].map(id=>document.getElementById(id).value).join('__'));
   await page.waitForFunction(key=>document.getElementById('samples').data[0].meta?.outcome===key,key);
   const actual=await page.locator('#samples').evaluate(p=>p.data.filter(t=>t.meta?.agpSamples).flatMap(t=>t.ids.map((id,i)=>({id,prob:t.meta.outcome?t.marker.color[i]:null,hover:t.customdata[i],unavailable:t.meta.unavailable,context:t.meta.context}))));
   const values=bank.series[key].filter(v=>v!==null).sort((a,b)=>a-b);
   const percentile=p=>{const n=(values.length-1)*p,l=Math.floor(n);return values[l]*(1-n+l)+values[Math.ceil(n)]*(n-l)};
   const lower=percentile(.025),upper=percentile(.975);
   for(const v of actual){const row=rows.get(v.id),expected=row===undefined?null:bank.series[key][row];
    if(!v.context){if(expected===null)assert.equal(v.prob,null);else assert(typeof v.prob==='number'&&Math.abs(v.prob-Math.max(lower,Math.min(upper,expected)))<1e-12,key+' '+v.id)};
    if(row===undefined)assert(v.hover[2].includes('No participant linkage'));
    else if(expected===null)assert(v.hover[2].includes('Non-index visit'));
    else assert.equal(v.hover[2],(100*expected).toFixed(2)+'%','Hover must retain the original prediction, including clipped tails');
    const answer=row===undefined?null:bank.outcomes[key.split('__')[1]][row];assert.equal(v.hover[3],answer===null?'No recorded answer':answer?'Positive':'Negative');
   }
   const marker=await page.locator('#samples').evaluate(p=>p.data[0].marker);assert(Math.abs(marker.cmin-lower)<1e-12);assert(Math.abs(marker.cmax-upper)<1e-12);assert.equal(marker.showscale,true);
   assert(marker.colorbar.ticktext[0].startsWith('≤'));assert(marker.colorbar.ticktext.at(-1).startsWith('≥'));
   return actual;
  };
  assert.equal(await page.isChecked('#agpOutcomeEnabled'),false);
  const base=await snapshot(),baseGraph=await graph();await page.check('#agpOutcomeEnabled');
  let actual=await check();assert.equal(actual.length,24421);assert.equal(actual.filter(v=>v.unavailable).length,3098);assert.deepEqual(await snapshot(),base);assert.equal(await graph(),baseGraph);
  for(const method of ['l1-euclidean','max-euclidean','max-linf']){
   await page.selectOption('#sampleMethod',method);await check();
   const coords=population.fits[method].coordinates;
   const expected=population.ids.map((id,i)=>[id,...coords[i]]).sort((a,b)=>a[0].localeCompare(b[0]));assert.deepEqual(await snapshot(),expected);
  }
  const unchanged=await snapshot();
  for(const [outcome,method,policy,scope,kind] of [
   ['skin_condition','case_raw','all_visits','state','final'],['ibs','case_corrected','index','state','outer'],
   ['seasonal_allergies','knn','all_visits','global','outer'],['ibs','knn','index','global','final']]){
   for(const [id,value] of Object.entries({agpOutcome:outcome,agpOutcomeMethod:method,agpOutcomePolicy:policy,agpOutcomeScope:scope,agpOutcomeKind:kind}))await page.selectOption('#'+id,value);
   actual=await check();assert.deepEqual(await snapshot(),unchanged);assert.equal(actual.filter(v=>v.unavailable).length,policy==='index'?3098:10);
  }
  await page.selectOption('#agpOutcomeScope','state');await page.selectOption('#sampleColorScheme','90%-1-CST');await check();
  assert((await page.locator('#sampleContext').innerText()).includes('frozen merged 70%-1-CSTs'));
  if(!await page.locator('#graphVertexCharacteristics').evaluate(e=>e.open))await page.locator('#graphVertexCharacteristics > summary').click();
  await page.getByRole('button',{name:'Akkermansia muciniphila',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('sampleTitle').textContent.includes('Local 3D MDS'));await check();
  const local=await snapshot();await page.uncheck('#agpOutcomeEnabled');assert.deepEqual(await snapshot(),local);
  await page.check('#agpOutcomeEnabled');await check();assert.deepEqual(await snapshot(),local);
  await page.uncheck('#stateMode');await page.check('#unfoldFaces');await check();
  const unfolded=await snapshot();await page.reload();await ready();assert(await page.isChecked('#agpOutcomeEnabled'));await check();assert.deepEqual(await snapshot(),unfolded);
  await page.check('#stateMode');await page.click('#headerClearSelection');await check();
  const choice=await page.locator('#agpConnectionPicker option').nth(1).getAttribute('value');await page.selectOption('#agpConnectionPicker',choice);actual=await check();assert(actual.some(v=>v.context));
  const boundary=await snapshot();await page.uncheck('#agpOutcomeEnabled');assert.deepEqual(await snapshot(),boundary);
  await page.check('#agpOutcomeEnabled');await check();await page.click('#headerBackSelection');await check();await page.click('#headerForwardSelection');await check();
  await page.click('#headerClearSelection');await page.click('#maximize-samplePanel');await check();
  if(process.env.COSMIX_TEST_SCREENSHOT)await page.screenshot({path:process.env.COSMIX_TEST_SCREENSHOT});
  await page.click('#maximize-samplePanel');
  await page.getByText('Methods and interpretation',{exact:true}).click();
  const pdf=page.getByRole('link',{name:'Download full methods and results (PDF)'});assert((await pdf.getAttribute('href')).startsWith('data:application/pdf;base64,JVBER'));
  if(await page.locator('#datasetSelect option[value="comb-V3V4-tx"]').count()){
  await page.selectOption('#datasetSelect','comb-V3V4-tx');await page.waitForFunction(()=>document.getElementById('samples')?.data?.length&&!document.getElementById('agpOutcomeControls'),{},{timeout:90000});
  await page.selectOption('#datasetSelect','agp-24k-silva');await ready();await check();
   console.log('PASS unaffected comb and return to saved AGP outcome view');
  }

  assert.deepEqual(errors,[]);console.log('PASS original probabilities/answers by ID, percentile tail clipping, selection-independent scales, all 3 maps, local/unfolded views, boundary selection, history, persistence, PDF');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
