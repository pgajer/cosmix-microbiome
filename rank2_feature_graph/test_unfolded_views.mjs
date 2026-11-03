import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const elements=new Map(),el=id=>{if(!elements.has(id))elements.set(id,{value:'',checked:false,options:[],parentElement:{}});return elements.get(id)};
const ctx=vm.createContext({el,atob,console});const run=s=>vm.runInContext(s,ctx),plain=s=>JSON.parse(JSON.stringify(run(s)));
run(`let META={id:'fixture',revision:'v1'},activeCohort='all',activeStateMode='merged',selected=null,selectedVertex=1,preferredSampleEmbedding='local';
let participant={active:false},DATA={records:[{profile:0},{profile:1},{profile:1}],samples:{ids:['a','b','c'],pair:['1,2','1,2','1,2']}};
const BUNDLE_PACK={participants:{fixture:{analysisRevision:'a'}},datasetMaxNormalizedEmbeddings:{fixture:{version:1,dataset:'fixture',baseRevision:'v1',analysisRevision:'a',contexts:{},fits:{}}},datasetUnfoldedEmbeddings:{fixture:{version:1,dataset:'fixture',baseRevision:'v1',analysisRevision:'a',revision:'u',contexts:{},fits:{}}}};
const rank3UsesSamples=()=>false,candidateActive=()=>false,pureCoverageActive=()=>false,eligibleIndices=()=>[0,1,2],incidentEdges=()=>[{id:'1,2'}];
let localScope='local';function localSelectionFit(){return {fittingScope:localScope}}
let history=[],refreshed=0;function rememberSelection(){history.push(el('unfoldFaces').checked)}function refreshSamples(){refreshed++}
function decodeSavedCoordinates(s){return s.coordinates}
`);
for(const f of ['embedding_stress.js','max_normalized_views.js','unfolded_views.js'])run(fs.readFileSync(new URL(f,import.meta.url),'utf8'));
el('coverage').value='90';el('sampleEmbedding').value='maxnorm-euclidean-local';
run(`const key=datasetMaxNormalizedContext('vertex',1),normal={profiles:[0,1],metric:'euclidean',coordinates:[[0,0,0],[1,0,0]],evaluation:{relativeRms:0},solver:{backend:'analytic'}};
BUNDLE_PACK.datasetMaxNormalizedEmbeddings.fixture.contexts[key]='ordinary';BUNDLE_PACK.datasetMaxNormalizedEmbeddings.fixture.fits['ordinary:euclidean']=normal;
BUNDLE_PACK.datasetUnfoldedEmbeddings.fixture.contexts[key]='rotated';BUNDLE_PACK.datasetUnfoldedEmbeddings.fixture.fits['rotated:euclidean']={...normal,anchor:0,coordinates:[[0,0,0],[2,0,0]]};
installUnfoldedControls();syncUnfoldedControls();`);
assert.equal(el('unfoldFaces').parentElement.hidden,false);assert.equal(el('unfoldFaces').disabled,false);assert.equal(run('maxNormalizedLocalFit().coords[1][0]'),1);
el('panelUnfoldFaces').checked=true;el('panelUnfoldFaces').onchange();
assert.equal(run('unfoldedEnabled()'),true);assert.equal(run('maxNormalizedLocalFit().coords[1][0]'),2);assert.deepEqual(plain('maxNormalizedLocalFit().indices'),[0,1,2]);assert.deepEqual(plain('history'),[false]);
el('unfoldFaces').checked=false;el('unfoldFaces').onchange();assert.equal(run('maxNormalizedLocalFit().coords[1][0]'),1);assert.deepEqual(plain('history'),[false,true]);
assert.deepEqual(plain('unfoldedStressRows([[[0,1],[1,.2],[2,.3]],[[0,.3],[1,1],[2,.6]]],0)'),[[[1,.2],[2,.3]],[[1,1.7],[2,.6]]]);
assert.deepEqual(plain('unfoldedStressRows([[[0,.5],[1,1],[2,1]]],0)'),[[[1,1.5],[2,1]]]);
run(`el('unfoldFaces').checked=true;unfoldedStress(unfoldedEntry(),[{profile:0,xyz:[0,0,0]},{profile:1,xyz:[2,0,0]}],[[[0,1]],[[1,1]]])`);
assert.equal(run("embeddingStressDetails.get('sampleStress').result.relativeRms"),0);
run(`unfoldedStress(unfoldedEntry(),[{profile:1,xyz:[2,0,0]}],[[[1,1]]])`);
assert.equal(run("embeddingStressDetails.get('sampleStress').result.relativeRms"),null,'One visible profile has no pairwise stress');
assert.throws(()=>run(`unfoldedStress(unfoldedEntry(),[{profile:1,xyz:[9,0,0]}],[[[1,1]]])`),/coordinates differ/);
run("el('unfoldFaces').checked=true;el('sampleEmbedding').value='maxnorm-linf-local';syncUnfoldedControls()");assert.equal(el('unfoldFaces').disabled,true);assert.equal(el('unfoldFaces').checked,false);
run("el('sampleEmbedding').value='maxnorm-euclidean-local';selectedVertex=null;syncUnfoldedControls()");assert.equal(el('unfoldFaces').disabled,true);
run("selectedVertex=1;META.id='other';syncUnfoldedControls()");assert.equal(el('unfoldFaces').disabled,true);
console.log('PASS: rotation toggle restores original coordinates, preserves repeated records, synchronizes controls/history, transforms stress targets, and disables unsupported views.');

run("META.id='fixture';selectedVertex=null;selected='1,2';el('sampleEmbedding').value='maxnorm-euclidean-local';syncUnfoldedControls()");
assert.equal(el('unfoldFaces').parentElement.hidden,false);assert.equal(el('unfoldFaces').disabled,true);assert.match(el('unfoldFaces').parentElement.title,/edge view/);
run("selected=null;el('sampleEmbedding').value='maxnorm-euclidean';syncUnfoldedControls()");assert.equal(el('unfoldFaces').parentElement.hidden,true);
run("selectedVertex=1;el('sampleEmbedding').value='local';syncUnfoldedControls()");assert.equal(el('unfoldFaces').parentElement.hidden,false);assert.equal(el('unfoldFaces').disabled,true);
run("localScope='population-restriction';syncUnfoldedControls()");assert.equal(el('unfoldFaces').parentElement.hidden,true);
run("localScope='local';participant.active=true;syncUnfoldedControls()");assert.equal(el('unfoldFaces').parentElement.hidden,true);
console.log('PASS: header unfolding appears for local vertex and edge fits, hides on overview/global restrictions/participants, and explains missing edge fits or unsupported methods.');

// Self-contained edge bank: default, explicit anchor, ordinary view, and old bookmark.
ctx.esc=String;
run(`participant.active=false;selectedVertex=null;selected='1,2';el('sampleEmbedding').value='maxnorm-euclidean-local';
const edgeKey=datasetMaxNormalizedContext('group','1,2');
BUNDLE_PACK.datasetMaxNormalizedEmbeddings.fixture.contexts[edgeKey]='ordinary';
BUNDLE_PACK.datasetUnfoldedEdgeEmbeddings={fixture:{version:1,dataset:'fixture',baseRevision:'v1',analysisRevision:'a',revision:'e',scope:{complete:true},selections:{[edgeKey]:{endpoints:[1,2],defaultAnchorFeatureId:2}},contexts:{},fits:{}}};
const edgeBank=BUNDLE_PACK.datasetUnfoldedEdgeEmbeddings.fixture;
for(const id of [1,2]){edgeBank.contexts[JSON.stringify([...JSON.parse(edgeKey),String(id)])]='edge'+id+':euclidean';edgeBank.fits['edge'+id+':euclidean']={...normal,edge:'1,2',anchor:id-1,coordinates:[[0,0,0],[id+2,0,0]]};}
syncUnfoldedControls();`);
assert.equal(el('unfoldFaces').checked,true);assert.equal(run('unfoldedAnchorFeatureId'),2);
assert.equal(run('maxNormalizedLocalFit().coords[1][0]'),4);
el('unfoldAnchor').value='1';el('unfoldAnchor').onchange();run('syncUnfoldedControls()');
assert.equal(run('unfoldedAnchorFeatureId'),1);assert.equal(run('maxNormalizedLocalFit().coords[1][0]'),3);
el('unfoldFaces').checked=false;el('unfoldFaces').onchange();run('syncUnfoldedControls()');
assert.equal(el('unfoldFaces').checked,false);assert.equal(run('maxNormalizedLocalFit().coords[1][0]'),1);
run("selected=null;syncUnfoldedControls();selected='1,2';syncUnfoldedControls()");assert.equal(el('unfoldFaces').checked,false);
run('restoreUnfoldedChoice({unfoldFaces:true,unfoldAnchorFeatureId:2});syncUnfoldedControls()');assert.equal(el('unfoldFaces').checked,true);assert.equal(run('unfoldedAnchorFeatureId'),2);
run('restoreUnfoldedChoice({unfoldFaces:false});syncUnfoldedControls()');assert.equal(el('unfoldFaces').checked,false,'Legacy ordinary bookmarks must not adopt new default');
run("edgeBank.scope.complete=false;syncUnfoldedControls()");assert.equal(el('unfoldFaces').disabled,true,'Offline pilots are not enabled in the viewer');
console.log('PASS: edge defaults, both explicit anchors, repeated records, ordinary restoration, context preferences, legacy bookmarks and partial-bank disabling.');

run(`edgeBank.scope.complete=true;restoreUnfoldedChoice({unfoldFaces:true,unfoldAnchorFeatureId:2});syncUnfoldedControls();
const shown=unfoldedEntry();shown.validation={seeds:[{seed:17,relativeRms:.072162},{seed:29,relativeRms:.123572}]};shown.solver={backend:'sgd',seed:17,epochs:200};
unfoldedStress(shown,[{profile:0,xyz:[0,0,0]},{profile:1,xyz:[4,0,0]}],[[[0,1]],[[1,1]]]);`);
assert.match(el('sampleStress').title,/7.216%.*12.357%/);assert.match(el('sampleStress').title,/Initialization-sensitive/);
run(`const savedEdge={dataset:'fixture',datasetRevision:'v1',cohort:'all',stateMode:'merged',coverage:'90',maxNormalizedRevision:undefined,maxNormalizedLocalRevision:undefined,unfoldedEdgeRevision:'e',selection:{selectedVertex:null,selected:'1,2',embedding:'maxnorm-euclidean-local',unfoldFaces:true,unfoldAnchorFeatureId:2}};validateMaxNormalizedNamedView(savedEdge)`);
assert.throws(()=>run(`validateMaxNormalizedNamedView({...savedEdge,selection:{...savedEdge.selection,unfoldAnchorFeatureId:3}})`),/endpoint anchor/);
assert.throws(()=>run(`validateMaxNormalizedNamedView({...savedEdge,unfoldedEdgeRevision:'stale'})`),/endpoint anchor/);
console.log('PASS: both start errors and sensitivity are inspectable; named edge views reject stale banks and foreign anchors.');

// Bounded comb bank routes through the special rebuilt-reference ordinary bank.
run(`let activeSensitivityMode='rebuilt';META={id:'comb-V3V4-tx',revision:'comb'};
participant.active=false;selectedVertex=1;selected=null;activeCohort='all';activeStateMode='merged';
BUNDLE_PACK.participants[META.id]={analysisRevision:'cp'};BUNDLE_PACK.combDisplay={revision:'cd'};
BUNDLE_PACK.maxNormalizedEmbeddings={baseRevision:'comb',sensitivityRevision:'cd',localEmbeddings:{version:2,levels:{'60':{cohort:'all',stateMode:'merged',contexts:{'vertex:1':'plain'}}},fits:{'plain:euclidean':normal}}};
BUNDLE_PACK.datasetUnfoldedEmbeddings[META.id]={version:1,dataset:META.id,baseRevision:'comb',analysisRevision:'cp',displayRevision:'cd',revision:'cu',scope:{complete:false},contexts:{'["all","merged","60","vertex","1"]':'unfold'},fits:{'unfold:euclidean':{...normal,anchor:0,coordinates:[[0,0,0],[2,0,0]]}}};
el('coverage').value='60';el('unfoldFaces').checked=false;el('sampleEmbedding').value='maxnorm-euclidean-local';syncUnfoldedControls();`);
assert.equal(el('unfoldFaces').disabled,false);assert.equal(run('maxNormalizedLocalFit().coords[1][0]'),1);
run("el('unfoldFaces').checked=true");assert.equal(run('maxNormalizedLocalFit().coords[1][0]'),2);
assert.deepEqual(plain('maxNormalizedLocalFit().indices'),[0,1,2]);
run("el('coverage').value='80';syncUnfoldedControls()");assert.equal(el('unfoldFaces').disabled,true);
run("el('coverage').value='60';activeCohort='one-cohort';syncUnfoldedControls()");assert.equal(el('unfoldFaces').disabled,true);
run("activeCohort='all';BUNDLE_PACK.combDisplay.revision='stale';syncUnfoldedControls()");assert.equal(el('unfoldFaces').disabled,true);
console.log('PASS: bounded comb unfolding preserves records and ordinary coordinates, rejecting unsupported coverage/cohorts and stale populations.');

run(`META={id:'fixture',revision:'v1'};activeCohort='all';activeStateMode='merged';selectedVertex=1;selected=null;el('coverage').value='90';
const oldVertexContext=datasetMaxNormalizedContext('vertex',1),oldVertexBank=BUNDLE_PACK.datasetUnfoldedEmbeddings.fixture;
oldVertexBank.fits['rotated:euclidean'].receipt='same-geometry-receipt';
oldVertexBank.compatibleRevisions={'prior-bank':{[oldVertexContext]:'same-geometry-receipt'}};
const oldVertexBookmark={dataset:'fixture',datasetRevision:'v1',cohort:'all',stateMode:'merged',coverage:'90',maxNormalizedRevision:undefined,maxNormalizedLocalRevision:undefined,unfoldedRevision:'prior-bank',selection:{selectedVertex:1,selected:null,embedding:'maxnorm-euclidean-local',unfoldFaces:true}};
validateMaxNormalizedNamedView(oldVertexBookmark);`);
assert.throws(()=>run(`validateMaxNormalizedNamedView({...oldVertexBookmark,unfoldedRevision:'foreign-bank'})`),/vertex supplement/);
run(`oldVertexBank.fits['rotated:euclidean'].receipt='changed';`);
assert.throws(()=>run('validateMaxNormalizedNamedView(oldVertexBookmark)'),/vertex supplement/);
console.log('PASS: preserved vertex bookmarks require an explicit prior revision and an unchanged fit receipt.');
