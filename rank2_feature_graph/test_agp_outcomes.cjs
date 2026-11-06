const assert=require('assert/strict'),o=require('./agp_outcomes.js');
const identity='2805acb3d1da21309e0e972bc8cc6d05489ebc3138776c60c90130b454c870fd';
const population={ids:['a','b','c','unlinked'],countSha256:'count',featureSha256:'feature',schemes:{'70%-1-CST':{merged:['1','2','1','1']}}};
const bank={version:1,identity,countSha256:'count',featureSha256:'feature',sample:['c','a','b'],state:['1','1','2'],index:[0,2],series:{},outcomes:{}};
for(const p of Object.keys(o.policies))for(const out of Object.keys(o.outcomes))for(const m of Object.keys(o.methods))for(const s of Object.keys(o.scopes))for(const k of Object.keys(o.kinds))
 bank.series[[p,out,m,s,k].join('__')]=p==='index'?[0,null,1]:[0,.5,1];
for(const out of Object.keys(o.outcomes))bank.outcomes[out]=[null,0,1];
const valid=o.validate(bank,population);assert.equal(valid.rows.get('a'),1);assert.equal(valid.rows.get('unlinked'),undefined);
const first=Object.keys(bank.series)[0];bank.series[first][1]=0;
assert.throws(()=>o.validate(bank,population),/unavailable mask/);bank.series[first][1]=null;
bank.state[0]='2';assert.throws(()=>o.validate(bank,population),/memberships differ/);bank.state[0]='1';
bank.series[first][0]=NaN;assert.throws(()=>o.validate(bank,population),/probabilities/);bank.series[first][0]=0;
bank.outcomes.ibs[0]=false;assert.throws(()=>o.validate(bank,population),/answers/);bank.outcomes.ibs[0]=null;
assert.equal(o.validate(null,population),null);
const probabilities=[null,...Array.from({length:101},(_,i)=>i/100).reverse()],before=[...probabilities];
const scale=o.probabilityScale(probabilities);
assert.equal(scale.lower,.025);assert.equal(scale.upper,.975);assert.deepEqual(scale.ticktext,['≤2.50%','26.25%','50.00%','73.75%','≥97.50%']);
assert.deepEqual(probabilities,before,'Scaling must not alter saved predictions');
assert.equal(o.probabilityScale([null,null]),null);
for(const value of [0,.2,1]){const constant=o.probabilityScale([value,null,value]);assert.equal(constant.lower,value);assert.equal(constant.upper,value);assert(constant.cmin<constant.cmax);assert.deepEqual(constant.tickvals,[value])}
assert.deepEqual([o.probabilityScale([0,1]).lower,o.probabilityScale([0,1]).upper],[.025,.975]);
console.log('PASS ID alignment, masks, frozen states, percentile interpolation, unchanged predictions and constant-value scales');
