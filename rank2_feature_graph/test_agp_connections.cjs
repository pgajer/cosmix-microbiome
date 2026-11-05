const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const C=require('./agp_connections.js');
// Unequal group sizes, one-sided contact, strict boundaries and shared-only overlap.
const bank={pureStates:[1,1,1,2,2,3],geometries:{g:{20:{edges:[
 {a:1,b:2,boundaryA:[0,1],boundaryB:[3],twoA:[1],twoB:[],intensityA:.2,intensityB:.1,jaccard:.5,paga:.8,knownParticipants:2,unlinkedRecords:1,twoKnownParticipants:1,twoUnlinkedRecords:0},
 {a:1,b:3,boundaryA:[],boundaryB:[],twoA:[],twoB:[],intensityA:0,intensityB:0,jaccard:.3,paga:0,knownParticipants:0,unlinkedRecords:0,twoKnownParticipants:0,twoUnlinkedRecords:0}
]}}}};
const scheme={k:1,cores:['1','2','3']};
const boundary=C.edges(bank,scheme,'g',20);
assert.equal(boundary[0].weight,Math.sqrt(1/3));assert.deepEqual(boundary[0].ba,[0,1]);
assert.equal(C.edges(bank,scheme,'g',20,'boundary','two-only')[0].weight,0);
assert.ok(Math.abs(C.edges(bank,scheme,'g',20,'intensity')[0].weight-Math.sqrt(.02))<1e-14);
assert.equal(C.filter(boundary,0,1).length,1);
assert.equal(C.filter(boundary,0,2).length,0);
assert.equal(C.filter(C.edges(bank,scheme,'g',20,'jaccard'),0,0).length,2);
assert.equal(C.filter(C.edges(bank,scheme,'g',20,'jaccard'),0,1).length,1);
assert.equal(C.edges(bank,{k:1,cores:['1','3']},'g',20).length,1);
assert.deepEqual(C.edges(bank,{k:2,cores:['1,2']},'g',20),[]);
console.log('PASS synthetic boundary weights, strict/one-sided contact, filters and shared-only overlap');
if(process.argv[2]){
 const population=JSON.parse(fs.readFileSync(process.argv[2]));
 const connections=JSON.parse(fs.readFileSync(path.join(path.dirname(process.argv[2]),'pure-1cst-connections.json'))).agpConnections;
 C.validate(connections,population);
 for(const geometry of Object.keys(population.fits))for(const h of [10,20,40]){
  const large=C.edges(connections,population.schemes['90%-1-CST'],geometry,h);
  for(const q of [70,80,90]){
   const s=population.schemes[q+'%-1-CST'],edges=C.edges(connections,s,geometry,h);
   assert.equal(edges.length,s.cores.length*(s.cores.length-1)/2);
   for(const e of edges){assert.deepEqual(e,large.find(x=>x.state===e.state));assert.equal(e.n,e.ba.length+e.bb.length)}
  }
 }
 const mergedFile=path.join(path.dirname(process.argv[2]),'merged-1cst-connections.json');
 if(fs.existsSync(mergedFile)){
  const merged=JSON.parse(fs.readFileSync(mergedFile)).agpMergedConnections;
  connections.merged=C.validateMerged(merged,population);
  for(const geometry of Object.keys(population.fits))for(const h of [10,20,40])for(const q of [70,80,90]){
   const s=population.schemes[q+'%-1-CST'],edges=C.edges(connections,s,geometry,h,'boundary','inclusive',false);
   assert.equal(edges.length,s.cores.length*(s.cores.length-1)/2);
   for(const e of edges){
    assert.equal(e.nA,s.merged.filter(v=>Number(v)===e.a).length);
    assert.equal(e.nB,s.merged.filter(v=>Number(v)===e.b).length);
    assert(e.ba.every(i=>Number(s.merged[i])===e.a));assert(e.bb.every(i=>Number(s.merged[i])===e.b));
   }
  }
  const bad=structuredClone(merged);bad.coverages[70].memberships[0]=-1;
  assert.throws(()=>C.validateMerged(bad,population),/does not match/);
  console.log('PASS all 27 merged views: membership, denominators and corrupt-label rejection');
 }
 const bad=structuredClone(connections);bad.sampleIds.reverse();assert.throws(()=>C.validate(bad,population),/does not match/);
 const badRow=structuredClone(connections);const e=badRow.geometries['l1-euclidean'][20].edges.find(e=>e.boundaryA.length);
 e.boundaryA[0]=population.ids.length;assert.throws(()=>C.validate(badRow,population),/does not match/);
 console.log('PASS full saved bank: population identity, all 27 coverage views and corrupt input rejection');
}
