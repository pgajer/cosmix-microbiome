import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const c=vm.createContext({esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),el:()=>({value:'primary'})});
vm.runInContext(fs.readFileSync('rank2_feature_graph/transition_bayes.js','utf8'),c);
const cell={from:'A',to:'A',nP:10,nT:12,countP:2,countT:6,placebo:[.2,.05,.4],treatment:[.5,.3,.8],difference:[.3,.02,.6],increase:[.96],decrease:[.01],similar:[.03],priorSimilar:[.2]};
assert.equal(c.transitionBayesClass(cell,0),'Higher');assert.equal(c.transitionBayesClass({...cell,nP:0},0),'Unsupported');
assert.equal(c.transitionBayesClass({...cell,increase:[.01],decrease:[.96]},0),'Lower');
assert.equal(c.transitionBayesClass({...cell,increase:[.01],similar:[.96]},0),'Similar');
assert.equal(c.transitionBayesClass({...cell,increase:[.8]},0),'Uncertain');
const family=c.transitionBayesFamily([cell,{...cell,nP:0}],0);assert.equal(family.count,1);assert.ok(Math.abs(family.expectedFalse-.04)<1e-12);
assert.equal(c.transitionBayesFamily([{...cell,increase:[.5]}],0).expectedFalse,null);
const asset={states:['A'],thresholds:[.05],models:{primary:{cells:[cell]},stronger:{cells:[{...cell,increase:[.9]}]}}},labels=new Map([['A',{name:'Alpha < beta',key:'G1'}]]);
assert.equal(c.transitionBayesSensitivity(asset,cell,0),true);
const svg=c.transitionBayesMatrix(asset,{cells:[cell]},labels,0,'A');assert.match(svg,/\+30.0/);assert.match(svg,/↑\*/);assert.match(svg,/Alpha &lt; beta/);assert.match(svg,/tabindex="0"/);assert.match(svg,/±25/);
const csv=c.transitionBayesCsv(asset,{cells:[cell]},labels,0,'primary');assert.equal(csv.split('\n').length,2);assert.match(csv,/prior_sensitive/);assert.match(csv,/Higher/);assert.match(csv,/similarity is exploratory/);
console.log('PASS: Bayesian direction, practical similarity, uncertainty, unsupported rows, family error, prior sensitivity, accessible matrix and CSV.');
assert.equal(c.vertexBayesClass({...cell,missingSupportT:.1},0),'Unsupported');
const localAsset='rank2_feature_graph/sante_transition_bayes.json';
if(fs.existsSync(localAsset)){
 const a=JSON.parse(fs.readFileSync(localAsset));if(a.vertex){
  const labels=new Map(a.vertex.ids.map(id=>[id,'Vertex '+id]));
  for(const [prior,fit] of Object.entries(a.vertex.models)){
   const csv=c.vertexBayesCsv(a,fit,labels,10,prior);assert.equal(csv.split('\n').length,34);assert.match(csv,/standardized_treatment_pct/);assert.match(csv,/Exit complements retention/);
   for(const v of a.vertex.ids){const r=fit.cells.find(c=>c.from===v&&c.to==='retention'),e=fit.cells.find(c=>c.from===v&&c.to==='exit');assert.equal(r.nT,e.nT);assert.ok(Math.abs(r.difference[0]+e.difference[0])<1e-10);assert.deepEqual(r.increase,e.decrease);}
  }
  console.log('PASS: real vertex prior summaries, complementarity, standardized CSV and unsupported strata.');
 }
}
