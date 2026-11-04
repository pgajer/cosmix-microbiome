const {chromium}=require('playwright'),assert=require('assert/strict');
const [origin,population]=process.argv.slice(2);
assert(origin&&population,'Pass the loopback origin and the reviewed population.json');
const reference=JSON.parse(require('fs').readFileSync(population));
(async()=>{
 const b=await chromium.launch({channel:'chrome',args:['--enable-unsafe-swiftshader']});
 try{
 const page=await b.newPage({viewport:{width:1420,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(new URL('/?dataset=agp-24k-silva',origin).href);await page.waitForSelector('#samples canvas',{timeout:60000});
 for(const [scheme,s] of Object.entries(reference.schemes)){
  await page.selectOption('#sampleColorScheme',scheme);
  for(const merged of [true,false]){
   await page.locator('#stateMode').setChecked(merged);
   for(const [method,fit] of Object.entries(reference.fits)){
    await page.selectOption('#sampleMethod',method);
    const sample=await page.locator('#samples').evaluate(g=>{const t=g.data[0];return {n:t.ids.length,
      row:[0,Math.floor(t.ids.length/2),t.ids.length-1].map(i=>[t.ids[i],t.x[i],t.y[i],t.z[i],t.customdata[i][0]])}});
    const n=merged?24421:s.assignment.filter(v=>v==='core').length;
    assert.equal(sample.n,n);
    for(const [id,x,y,z,label] of sample.row){const i=reference.ids.indexOf(id);assert.deepEqual([x,y,z],fit.coordinates[i]);assert.equal(label,s.labels[s.merged[i]]);if(!merged)assert.equal(s.original[i],s.merged[i])}
   }
  }
  console.log('PASS',scheme);
 }
 assert.deepEqual(errors,[]);
 await page.selectOption('#datasetSelect','empty');await page.waitForURL('**/empty.html');await page.selectOption('#datasetSelect','agp-24k-silva');await page.waitForSelector('#samples canvas',{timeout:30000});
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
