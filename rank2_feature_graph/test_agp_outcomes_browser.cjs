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
  const checkStateControls=async outcome=>{
   const parent=outcome?'#agpStateGraphControls':'#agpColorControls';
   assert.equal(await page.locator(parent+' #agpStateScheme').count(),1);
   assert.equal(await page.locator(parent+' #stateMode').count(),1);
   assert.equal(await page.locator('#agpStateGraphControls').isVisible(),outcome);
   assert(await page.locator('#graphDetails').evaluate(e=>e.firstElementChild.id==='agpStateGraphControls'));
  };
  const enable=async()=>{await page.selectOption('#sampleColorScheme','outcome-probability');await checkStateControls(true)};
  const disable=async()=>{await page.selectOption('#sampleColorScheme',await page.locator('#agpStateScheme').inputValue());await checkStateControls(false)};
  const check=async()=>{
   const key=await page.evaluate(()=>['agpOutcomePolicy','agpOutcome','agpOutcomeMethod','agpOutcomeScope','agpOutcomeKind'].map(id=>document.getElementById(id).value).join('__'));
   const relative=await page.isChecked('#agpOutcomeRelative');
   await page.waitForFunction(({key,relative})=>{const m=document.getElementById('samples').data[0].meta;return m?.outcome===key&&m.relative===relative},{key,relative});
   const answers=bank.index.map(i=>bank.outcomes[key.split('__')[1]][i]).filter(v=>v!==null),mean=answers.reduce((a,b)=>a+b,0)/answers.length,divisor=relative?mean:1;
   const actual=await page.locator('#samples').evaluate(p=>p.data.filter(t=>t.meta?.agpSamples).flatMap(t=>t.ids.map((id,i)=>({id,prob:t.meta.outcome?t.marker.color[i]:null,hover:t.customdata[i],unavailable:t.meta.unavailable,context:t.meta.context}))));
   const values=bank.series[key].filter(v=>v!==null).map(v=>v/divisor).sort((a,b)=>a-b);
   const percentile=p=>{const n=(values.length-1)*p,l=Math.floor(n);return values[l]*(1-n+l)+values[Math.ceil(n)]*(n-l)};
   const lower=percentile(.025),upper=percentile(.975);
   for(const v of actual){const row=rows.get(v.id),expected=row===undefined?null:bank.series[key][row];
    if(!v.context){if(expected===null)assert.equal(v.prob,null);else assert(typeof v.prob==='number'&&Math.abs(v.prob-Math.max(lower,Math.min(upper,expected/divisor)))<1e-12,key+' '+v.id)};
    if(row===undefined)assert(v.hover[2].includes('No participant linkage'));
    else if(expected===null)assert(v.hover[2].includes('Non-index visit'));
    else assert.equal(v.hover[2],(100*expected).toFixed(2)+'%','Hover must retain the original prediction, including clipped tails');
    if(relative&&expected!==null)assert.equal(v.hover[6],(expected/mean).toFixed(3)+'×','Hover must retain the original ratio, including clipped tails');
    const answer=row===undefined?null:bank.outcomes[key.split('__')[1]][row];assert.equal(v.hover[3],answer===null?'No recorded answer':answer?'Positive':'Negative');
   }
   const marker=await page.locator('#samples').evaluate(p=>p.data[0].marker);assert(Math.abs(marker.cmin-lower)<1e-12);assert(Math.abs(marker.cmax-upper)<1e-12);assert.equal(marker.showscale,true);
   assert(marker.colorbar.ticktext[0].startsWith('≤'));assert(marker.colorbar.ticktext.at(-1).startsWith('≥'));
   assert(marker.colorbar.ticktext.every(t=>t.endsWith(relative?'×':'%')));
   assert((await page.locator('#sampleContext').innerText()).includes((100*mean).toFixed(2)+'% ('+answers.reduce((a,b)=>a+b,0).toLocaleString()+' positive / '+answers.length.toLocaleString()));
   return actual;
  };
  assert.equal(await page.locator('#agpOutcomeEnabled').count(),0);
  assert(await page.locator('#agpOutcomeControls').isHidden());
  await checkStateControls(false);
  assert.equal(await page.locator('#samplePanel #sampleColorScheme').count(),1);
  assert.equal(await page.locator('.sampleHeaderActions #sampleColorScheme').count(),0);
  assert.equal(await page.locator('#controlSections #agpOutcomeControls').count(),0);
  const base=await snapshot(),baseGraph=await graph();await enable();
  let actual=await check();assert(await page.locator('#agpOutcomeControls').isVisible());assert(await page.locator('#agpStateScheme').isVisible());assert.equal(await page.locator('#agpStateScheme').inputValue(),'70%-1-CST');assert.equal(actual.length,24421);assert.equal(actual.filter(v=>v.unavailable).length,3098);assert.deepEqual(await snapshot(),base);assert.equal(await graph(),baseGraph);
  await page.check('#agpOutcomeRelative');await check();assert.deepEqual(await snapshot(),base);assert.equal(await graph(),baseGraph);
  await page.uncheck('#agpOutcomeRelative');await check();
  for(const method of ['l1-euclidean','max-euclidean','max-linf']){
   await page.selectOption('#sampleMethod',method);await check();
   const coords=population.fits[method].coordinates;
   const expected=population.ids.map((id,i)=>[id,...coords[i]]).sort((a,b)=>a[0].localeCompare(b[0]));assert.deepEqual(await snapshot(),expected);
  }
  const unchanged=await snapshot();
  for(const scheme of ['80%-1-CST','40%-2-CST','70%-1-CST']){
   await page.selectOption('#agpStateScheme',scheme);await check();
   assert.equal(await page.locator('#sampleColorScheme').inputValue(),'outcome-probability');assert.deepEqual(await snapshot(),unchanged);
  }
  for(const [outcome,method,policy,scope,kind] of [
   ['skin_condition','case_raw','all_visits','state','final'],['ibs','case_corrected','index','state','outer'],
   ['seasonal_allergies','knn','all_visits','global','outer'],['ibs','knn','index','global','final']]){
   for(const [id,value] of Object.entries({agpOutcome:outcome,agpOutcomeMethod:method,agpOutcomePolicy:policy,agpOutcomeScope:scope,agpOutcomeKind:kind}))await page.selectOption('#'+id,value);
   actual=await check();assert.deepEqual(await snapshot(),unchanged);assert.equal(actual.filter(v=>v.unavailable).length,policy==='index'?3098:10);
   await page.check('#agpOutcomeRelative');await check();assert.deepEqual(await snapshot(),unchanged);
   await page.uncheck('#agpOutcomeRelative');await check();
  }
  await page.selectOption('#agpOutcomeScope','state');await page.selectOption('#agpStateScheme','90%-1-CST');await check();
  assert((await page.locator('#sampleContext').innerText()).includes('frozen merged 70%-1-CSTs'));
  if(!await page.locator('#graphVertexCharacteristics').evaluate(e=>e.open))await page.locator('#graphVertexCharacteristics > summary').click();
  await page.getByRole('button',{name:'Akkermansia muciniphila',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('sampleTitle').textContent.includes('Local 3D MDS'));await check();
  const local=await snapshot();await disable();assert.deepEqual(await snapshot(),local);
  await enable();await check();assert.deepEqual(await snapshot(),local);
  await page.check('#agpOutcomeRelative');await check();assert.deepEqual(await snapshot(),local);
  assert.equal(await page.locator('#agpShowBackground').isVisible(),false);
  await page.uncheck('#stateMode');await page.check('#unfoldFaces');await check();
  const unfolded=await snapshot();await page.reload();await ready();assert.equal(await page.locator('#sampleColorScheme').inputValue(),'outcome-probability');assert(await page.isChecked('#agpOutcomeRelative'));await check();await checkStateControls(true);assert.deepEqual(await snapshot(),unfolded);
  await page.check('#stateMode');await page.click('#headerClearSelection');await check();
  const choice=await page.locator('#agpConnectionPicker option').nth(1).getAttribute('value');await page.selectOption('#agpConnectionPicker',choice);actual=await check();assert(actual.some(v=>v.context));
  const boundary=await snapshot();await disable();assert.deepEqual(await snapshot(),boundary);
  await enable();await check();await page.click('#headerBackSelection');await check();await page.click('#headerForwardSelection');await check();
  actual=await check();const selectedIds=new Set(actual.filter(v=>!v.context).map(v=>v.id)),selectedCoordinates=boundary.filter(v=>selectedIds.has(v[0])),edgeGraph=await graph();
  assert(await page.locator('#agpShowBackground').isVisible());await page.uncheck('#agpShowBackground');actual=await check();
  assert(actual.length>0&&actual.length<boundary.length);assert(actual.every(v=>!v.context));assert.deepEqual(await snapshot(),selectedCoordinates);assert.equal(await graph(),edgeGraph);
  const displayedN=await page.locator('#sampleContext table').evaluate(t=>Array.from(t.rows).slice(1).reduce((n,r)=>n+Number(r.cells[3].textContent.replaceAll(',','')),0));assert.equal(displayedN,actual.length);
  await disable();assert.deepEqual(await snapshot(),selectedCoordinates);
  await enable();await check();await page.reload();await ready();assert.equal(await page.isChecked('#agpShowBackground'),false);await check();assert.deepEqual(await snapshot(),selectedCoordinates);
  await page.check('#agpShowBackground');await check();assert.deepEqual(await snapshot(),boundary);
  await page.uncheck('#stateMode');actual=await check();const pureSelected=new Set(actual.filter(v=>!v.context).map(v=>v.id));
  await page.uncheck('#agpShowBackground');actual=await check();assert.deepEqual(new Set(actual.map(v=>v.id)),pureSelected);
  await page.check('#stateMode');await page.check('#agpShowBackground');await check();
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

  // Migrate an existing saved view with the removed independent checkbox.
  const beforeMigration=await snapshot(),storageKey='cosmix-agp-view-v1:agp-24k-silva';
  const retainedScheme=await page.locator('#agpStateScheme').inputValue();
  await page.goto(origin+'/empty.html');
  await page.evaluate(k=>{const p=JSON.parse(localStorage.getItem(k));p.controls.sampleColorScheme=p.controls.agpStateScheme;
   delete p.controls.agpStateScheme;p.controls.agpOutcomeEnabled=true;p.details.agpOutcomeControls=false;delete p.details.agpColorControls;
   localStorage.setItem(k,JSON.stringify(p))},storageKey);
  await page.goto(origin+'/?dataset=agp-24k-silva');await ready();await check();
  assert.equal(await page.locator('#sampleColorScheme').inputValue(),'outcome-probability');
  assert.equal(await page.locator('#agpStateScheme').inputValue(),retainedScheme);assert(await page.locator('#agpOutcome').isVisible());
  assert.deepEqual(await snapshot(),beforeMigration);
  assert.equal(await page.evaluate(k=>'agpOutcomeEnabled' in JSON.parse(localStorage.getItem(k)).controls,storageKey),false);
  console.log('PASS sidebar placement, conditional controls and migration of the removed checkbox');
  assert.deepEqual(errors,[]);console.log('PASS probabilities and ratios, fixed participant baseline, percentile clipping, all 3 maps, local/unfolded views, boundary-only filtering/counts, unchanged coordinates/graph, persistence, PDF');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
