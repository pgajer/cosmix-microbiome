import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('participant_exploration.js',import.meta.url),'utf8');
const context={assert,participantKey:r=>JSON.stringify([r.cohort,r.subject])};vm.createContext(context);
vm.runInContext(source+String.raw`
const row=(subject,stage,profile)=>({subject,cohort:'Test',originalVisit:stage,profile,id:subject+stage});
const records=[row('a','enrollment_ANC',0),row('a','follow_up_ANC',1),row('b','enrollment_ANC',2),row('b','follow_up_ANC',3),row('c','enrollment_ANC',4),row('d','follow_up_ANC',5)];
const compositions={0:[[0,.9],[1,.1]],1:[[0,.1],[1,.9]],2:[[0,.8],[1,.2]],3:[[0,1]],4:[[0,.8],[1,.2]],5:[[1,1]]};
const settings={...explorationDefaults(),visit:'enrollment',nearby:true,anchor:'a',k:1};
let model=explorationModel(records,compositions,settings);
assert.equal(model.chosen.length,3,'cutoff ties must all be retained');
assert.equal(model.rows.length,3,'only enrollment is highlighted');
assert.ok(model.rows.every(r=>r.originalVisit==='enrollment_ANC'));
assert.equal(model.context.length,3,'all other visits remain in context');
function checkPartition(m){assert.equal(new Set([...m.rows,...m.context]).size,records.length);assert.equal(m.rows.length+m.context.length,records.length);assert.ok(m.context.every(r=>!m.rows.includes(r)))}
checkPartition(model);
assert.equal(explorationDefaults().color,'#0072b2');assert.equal(explorationDefaults().treatment,false);

let follow=explorationModel(records,compositions,{...settings,visit:'followup'});
checkPartition(follow);
assert.equal(follow.rows.length,2,'missing follow-up is not invented');
assert.equal(follow.chosen.map(g=>g.key).join('|'),model.chosen.map(g=>g.key).join('|'),'same participants across visit switches');
compositions[3]=[[1,1]];
assert.equal(explorationModel(records,compositions,settings).chosen.map(g=>g.key).join('|'),model.chosen.map(g=>g.key).join('|'),'follow-up composition cannot change neighborhoods');
model=explorationModel(records,compositions,{...settings,pairedOnly:true,visit:'paired'});
assert.equal(model.chosen.length,2);assert.equal(model.rows.length,4);
model=explorationModel(records,compositions,{...settings,nearby:false,visit:'followup'});
assert.equal(model.rows.length,3,'all follow-ups includes women lacking enrollment');
assert.ok(explorationModel(records,compositions,{...settings,anchor:'d'}).error);
assert.equal(explorationDistance([[0,1]],[[1,1]],'max-linf'),1);
assert.equal(explorationDistance([[0,1]],[[1,1]],'l1-euclidean'),Math.sqrt(2));
assert.equal(explorationDistance([[0,.5],[1,.5]],[[0,1],[1,1]],'max-euclidean'),0);
const heatmapSettings={...explorationDefaults(),visit:'paired',subjects:['a','c']};
const heatmapModel=explorationModel(records,compositions,heatmapSettings);
checkPartition(heatmapModel);assert.equal(heatmapModel.context.length,3);
assert.equal(heatmapModel.chosen.length,2);assert.equal(heatmapModel.rows.length,3,'keep enrollment when follow-up is missing');
assert(heatmapModel.rows.every(r=>['a','c'].includes(r.subject)));
assert.equal(explorationModel(records,compositions,{...heatmapSettings,pairedOnly:true}).rows.length,2);
assert.equal(explorationModel(records,compositions,{...heatmapSettings,visit:'followup'}).rows.length,1);
const ambiguous=[...records,row('a','enrollment_ANC',6)];
assert.ok(explorationModel(ambiguous,compositions,settings).error,'ambiguous enrollment is not arbitrarily selected');
`,context);
console.log('Enrollment neighborhoods: visit highlights with disjoint full-population context, pairing, ties, missing/ambiguous enrollment, original-space metrics and outcome-independent selection passed.');

// Real slider handlers: independent changes, saved appearance, camera and identity preservation.
const controls=new Map(),preferences=new Map();
context.el=id=>{if(!controls.has(id))controls.set(id,{});return controls.get(id)};
context.datasetPanelStorage={getItem:k=>preferences.get(k)||null,setItem:(k,v)=>preferences.set(k,v)};
context.readCamera=()=>({eye:{x:1,y:2,z:3}});context.refreshSamples=camera=>{context.camera=camera};
context.META={id:'sante-16s'};context.BUNDLE_PACK={participants:{'sante-16s':{records:[]}}};
vm.runInContext(`syncExplorationControls=()=>{};explorationActive=()=>true;installExploration();baselineExplore={...explorationDefaults(),dataset:'sante-16s',visit:'enrollment',subjects:null};`,context);
for(const [key,value] of [['highlightSize',9],['highlightOpacity',85],['contextSize',3],['contextOpacity',15],['lineWidth',7],['lineOpacity',90]]){
 context.el('enrollment'+key).value=String(value);context.el('enrollment'+key).oninput();
}
vm.runInContext(`
assert.equal(baselineExplore.highlightSize,9);assert.equal(baselineExplore.highlightOpacity,.85);
assert.equal(baselineExplore.lineWidth,7);assert.equal(baselineExplore.lineOpacity,.9);
assert.equal(baselineExplore.contextSize,3);assert.equal(baselineExplore.contextOpacity,.15);
assert.equal(baselineExplore.visit,'enrollment');assert.equal(baselineExplore.subjects,null);
const restoredAppearance=loadExplorationAppearance();assert.equal(restoredAppearance.lineWidth,7);assert.equal(restoredAppearance.lineOpacity,.9);assert.equal(restoredAppearance.highlightSize,9);assert.equal(restoredAppearance.contextOpacity,.15);
const savedView=JSON.parse(JSON.stringify(explorationSnapshot()));explorationValidate(savedView,{dataset:{id:'sante-16s'}});
explorationRestore(savedView);assert.equal(baselineExplore.highlightSize,9);
for(const invalid of [{highlightSize:0},{contextSize:17},{highlightOpacity:NaN},{contextOpacity:1.01},{lineWidth:0},{lineOpacity:1.1}])assert.throws(()=>explorationValidate({...savedView,...invalid},{dataset:{id:'sante-16s'}}));
const oldView={...savedView};for(const [key] of explorationAppearanceControls)delete oldView[key];
explorationValidate(oldView,{dataset:{id:'sante-16s'}});explorationRestore(oldView);assert.equal(baselineExplore.highlightSize,6);assert.equal(baselineExplore.contextOpacity,.28);assert.equal(baselineExplore.lineWidth,3);assert.equal(baselineExplore.lineOpacity,.6);
updateExplorationAppearance('contextOpacity',0);assert.equal(baselineExplore.contextOpacity,0);assert.equal(baselineExplore.highlightOpacity,.7);
`,context);
assert.deepEqual(context.camera,{eye:{x:1,y:2,z:3}});
preferences.set('vme-visit-highlight-appearance-v1','{"highlightSize":999,"contextOpacity":-1}');
assert.equal(vm.runInContext('loadExplorationAppearance().highlightSize',context),6);
context.datasetPanelStorage.getItem=()=>{throw Error('storage unavailable')};
assert.equal(vm.runInContext('loadExplorationAppearance().contextSize',context),2);
console.log('Visit appearance: independent sliders, zero opacity, unchanged selection/camera, persistence, legacy views and invalid settings passed.');

vm.runInContext(`
const lineSettings={...explorationDefaults(),visit:'paired',treatment:true};
const lineModel=explorationModel(records,compositions,lineSettings);
const positions=new Map(records.map(r=>[r.profile,[r.profile,2*r.profile,3*r.profile]]));
const annotations={records:Object.fromEntries(records.map(r=>[r.id,{arm:r.subject==='a'?'Azithromycin':'Placebo'}]))};
const beforeLines=JSON.stringify({lineModel,records,positions:[...positions]});
const lines=explorationLineTraces(lineModel,positions,lineSettings,annotations);
assert.equal(lines.length,2);assert.equal(lines[0].line.color,explorationArms.Azithromycin);assert.equal(lines[1].line.color,explorationArms.Placebo);
assert.equal(lines.flatMap(t=>t.x).filter(x=>x!==null).length,4,'only the two complete observed pairs are joined');
const changed=explorationLineTraces(lineModel,positions,{...lineSettings,lineWidth:12,lineOpacity:.2},annotations);
assert.deepEqual(changed.map(t=>[t.x,t.y,t.z]),lines.map(t=>[t.x,t.y,t.z]));
assert(changed.every(t=>t.line.width===12&&t.opacity===.2));
assert.equal(explorationLineTraces(lineModel,positions,{...lineSettings,lineOpacity:0},annotations)[0].opacity,0);
assert.equal(explorationLineTraces(lineModel,positions,{...lineSettings,lines:false},annotations).length,0);
assert.equal(explorationLineTraces(lineModel,positions,{...lineSettings,visit:'enrollment'},annotations).length,0);
assert.equal(explorationLineTraces(lineModel,positions,{...lineSettings,treatment:false,color:'#cc3399'},annotations)[0].line.color,'#cc3399');
assert.equal(JSON.stringify({lineModel,records,positions:[...positions]}),beforeLines);
`,context);
console.log('Connecting lines: independent thickness/opacity, complete pairs only, unchanged endpoints and treatment colors passed.');

// A reference sample can be outside the highlight (or outside the selected group).
context.fmt=n=>String(n);context.esc=s=>String(s).replaceAll('<','&lt;');
vm.runInContext(`
const refNodes=[{id:10,anchor_row:1,label:'Taxon A',maximum:98},{id:11,anchor_row:1,label:'Taxon B',maximum:90},{id:12,anchor_row:5,label:'Taxon C',maximum:99}];
const refsBefore=JSON.stringify({refNodes,records,positions:[...positions]});
const refs=explorationReferences(refNodes,records,positions);
assert.equal(refs.traces.length,1);assert.equal(refs.traces[0].x.length,2,'shared anchor compositions get one marker');
assert.equal(refs.annotations.length,3,'each vertex retains its selectable label');
assert.equal(refs.traces[0].customdata[0],'endpoint-vertices:10,11');
assert.equal(refs.annotations[2].name,'endpoint-vertex:12');
assert.equal(refs.traces[0].meta.referenceVertices,true);
assert.equal(refs.traces[0].meta.sampleView,undefined);assert.equal(refs.traces[0].ids,undefined,'reference markers cannot count as samples');
for(const visit of ['enrollment','followup','paired','delivery']){
 const m=explorationModel(records,compositions,{...explorationDefaults(),visit,subjects:['c']});
 assert(!m.rows.includes(records[1])&&!m.rows.includes(records[5]));
 assert.deepEqual(explorationReferences(refNodes,records,positions),refs,'highlight membership must not choose reference anchors');
}
const shifted=new Map([...positions].map(([p,v])=>[p,v.map(x=>x+100)]));
assert.deepEqual(explorationReferences(refNodes,records,shifted).traces[0].x,refs.traces[0].x.map(x=>x+100),'references follow the chosen population embedding');
assert.equal(JSON.stringify({refNodes,records,positions:[...positions]}),refsBefore);
assert.equal(explorationReferences(refNodes,records,new Map()).traces.length,0,'missing coordinates must not be invented');
`,context);
console.log('Visit references: independent of highlights, fixed population coordinates, grouped anchors, selectable labels and no added sample counts passed.');

// Arrow direction is geometric, independent of labels, colors or camera rotation.
vm.runInContext(`
assert.equal(explorationDefaults().arrows,false);
const arrowPaths=[[[0,0,0],[10,0,0]],[[0,0,0],[0,-10,0]],[[0,0,0],[0,0,10]],[[2,2,2],[2,2,2]]];
const arrow=explorationArrowMesh(arrowPaths,10,'#123456',.42,3);
assert.equal(arrow.x.length,30,'one cone per noncoincident endpoint pair');
assert.equal(arrow.i.length,48);assert.equal(arrow.color,'#123456');assert.equal(arrow.opacity,.42);
for(let k=0;k<3;k++){
 const tip=['x','y','z'].map(axis=>arrow[axis][10*k]),base=['x','y','z'].map(axis=>arrow[axis][10*k+1]);
 const [a,b]=arrowPaths[k],direction=b.map((v,j)=>v-a[j]);
 assert(tip.reduce((sum,v,j)=>sum+(v-base[j])*direction[j],0)>0,'tip points toward follow-up');
 assert(tip.every((v,j)=>Math.abs(v-(a[j]+.78*direction[j]))<1e-10));
}
assert.equal(explorationArrowMesh([[[1,1,1],[1,1,1]]],10,'red',1,3),null);
const curved=explorationArrowMesh([[[0,0,0],[10,0,0],[10,5,0],[10,5,0]]],10,'red',1,3);
assert(curved.y[0]>curved.y[1]&&curved.x[0]===curved.x[1],'path arrow uses last nonzero segment, including repeated endpoints');
const withArrows=explorationLineTraces(lineModel,positions,{...lineSettings,arrows:true},annotations);
assert.equal(withArrows.filter(t=>t.meta?.enrollmentDirection).length,2);
assert.deepEqual(withArrows.filter(t=>t.type==='scatter3d'),lines,'arrows do not alter line geometry or appearance');
assert.equal(explorationLineTraces(lineModel,positions,{...lineSettings,arrows:true,lines:false},annotations).length,0);
assert.equal(explorationLineTraces(lineModel,positions,{...lineSettings,arrows:true,visit:'enrollment'},annotations).length,0);
const legacy={...savedView};delete legacy.arrows;explorationRestore(legacy);assert.equal(baselineExplore.arrows,false);
assert.throws(()=>explorationValidate({...savedView,arrows:'yes'},{dataset:{id:'sante-16s'}}));
`,context);
context.datasetPanelStorage.getItem=k=>preferences.get(k)||null;
context.el('enrollmentArrows').checked=true;context.el('enrollmentArrows').onchange();
assert.equal(vm.runInContext('baselineExplore.arrows',context),true);
assert.equal(vm.runInContext('loadExplorationAppearance().arrows',context),true);
assert.equal(vm.runInContext('explorationSnapshot().arrows',context),true);
assert.deepEqual(context.camera,{eye:{x:1,y:2,z:3}});
console.log('Direction arrows: enrollment-to-follow-up orientation, repeated/coincident points, grouped meshes, unchanged lines, installed toggle, persistence and legacy views passed.');

vm.runInContext(`
const bank={paths:Object.fromEntries(lineModel.chosen.filter(g=>g.enrollment&&g.followup).map(g=>[g.key,{profiles:[g.enrollment.profile,5,g.followup.profile]}]))};
const routed=explorationLineTraces(lineModel,positions,{...lineSettings,path:'fermat11',arrows:true},annotations,bank);
assert.equal(routed.filter(t=>t.type==='mesh3d').length,2);
const routeLines=routed.filter(t=>t.type==='scatter3d');
assert.equal(routeLines[0].x.join(','),'0,5,1,','path uses full-pool intermediate outside this pair');
assert.equal(routeLines[1].x.join(','),'2,5,3,');
assert.deepEqual(routeLines.map(t=>t.line.color),lines.map(t=>t.line.color));
assert.throws(()=>explorationLineTraces(lineModel,positions,{...lineSettings,path:'fermat125'},annotations,null),/unavailable/,'never silently substitute straight lines');
assert.throws(()=>explorationLineTraces(lineModel,new Map([[0,[0,0,0]]]),{...lineSettings,path:'fermat11'},annotations,bank),/missing embedding/);
assert.equal(explorationLineTraces(lineModel,positions,{...lineSettings,path:'fermat11',lines:false},annotations,bank).length,0);
const previous={...savedView};delete previous.path;explorationRestore(previous);assert.equal(baselineExplore.path,'straight');
assert.throws(()=>explorationValidate({...savedView,path:'fermat11'},{dataset:{id:'sante-16s'}}),/unavailable/);
`,context);
context.maxNormalizedMethod=()=>context.displayMethod||'l1-euclidean';
context.participantData=()=>({analysisRevision:'a'});context.META.revision='r';
context.BUNDLE_PACK.trajectoryPaths={'sante-16s':{datasetRevision:'r',analysisRevision:'a',methods:{'l1-euclidean':{fermat11:{tag:1}},'max-euclidean':{fermat11:{tag:2}},'max-linf':{fermat11:{tag:3}}}}};
context.el('enrollmentPath').value='fermat11';context.el('enrollmentPath').onchange();
for(const [method,tag] of [['l1-euclidean',1],['maxnorm-euclidean',2],['maxnorm-linf',3]]){
 context.displayMethod=method;assert.equal(vm.runInContext('explorationPathBank().tag',context),tag);
}
assert.deepEqual(context.camera,{eye:{x:1,y:2,z:3}});
console.log('Fermat route rendering: fixed support, all intermediate coordinates, treatment colors, arrows, selected metric, missing-route rejection and legacy views passed.');

// Anchor emphasis changes appearance only, with no duplicate samples or routes.
context.sampleViewKey=()=> 'test-view';context.explorationHover=r=>r.id;
vm.runInContext(`
const displayRows=records.map((r,index)=>({...r,index}));
const emphasisSettings={...lineSettings,nearby:true,anchor:'a',highlightSize:6,highlightOpacity:.7};
const markers=explorationVisitTraces(displayRows,positions,emphasisSettings,annotations);
assert.deepEqual(markers.flatMap(t=>t.ids).sort(),displayRows.map(r=>String(r.index)).sort(),'each sample appears once');
assert.equal(markers.filter(t=>t.meta.enrollmentAnchor).flatMap(t=>t.ids).join(','),'0,1');
for(const trace of markers){
 assert.equal(trace.marker.size,trace.meta.enrollmentAnchor?12:6);
 assert.equal(trace.marker.opacity,.7);
 assert.equal(trace.marker.line?.width,trace.meta.enrollmentAnchor?2:undefined);
 for(let j=0;j<trace.ids.length;j++)assert.deepEqual([trace.x[j],trace.y[j],trace.z[j]],positions.get(displayRows[Number(trace.ids[j])].profile));
}
assert(markers.filter(t=>t.meta.enrollmentAnchor).every(t=>t.text[0].startsWith('<b>Enrollment anchor participant</b>')));
assert.deepEqual(markers.filter(t=>t.meta.enrollmentAnchor).map(t=>t.marker.symbol),['circle','diamond']);
const nextMarkers=explorationVisitTraces(displayRows,positions,{...emphasisSettings,anchor:'b'},annotations);
assert.equal(nextMarkers.filter(t=>t.meta.enrollmentAnchor).flatMap(t=>t.ids).join(','),'2,3','emphasis moves to the new participant');
assert(!explorationVisitTraces(displayRows,positions,{...emphasisSettings,nearby:false},annotations).some(t=>t.meta.enrollmentAnchor),'a stale disabled anchor does not emphasize samples');
assert(explorationVisitTraces(displayRows,positions,{...emphasisSettings,highlightOpacity:0},annotations).every(t=>t.marker.opacity===0));
assert.equal(explorationVisitTraces(displayRows.filter(r=>explorationStage(r)==='enrollment'),positions,emphasisSettings,annotations).filter(t=>t.meta.enrollmentAnchor).flatMap(t=>t.ids).length,1,'hidden visits are not added');
for(const path of ['straight','fermat11','fermat125']){
 const plain=explorationLineTraces(lineModel,positions,{...lineSettings,path},annotations,bank);
 const emphasized=explorationLineTraces(lineModel,positions,{...emphasisSettings,path,arrows:true},annotations,bank);
 const paths=emphasized.filter(t=>t.type==='scatter3d');
 const byColor=ts=>ts.map(t=>[t.line.color,t.x,t.y,t.z]).sort((a,b)=>a[0].localeCompare(b[0]));
 assert.deepEqual(byColor(paths),byColor(plain),'route coordinates and treatment colors are unchanged');
 assert.equal(paths.find(t=>t.meta?.enrollmentAnchor).line.width,lineSettings.lineWidth*2);
 assert.equal(paths.find(t=>!t.meta?.enrollmentAnchor).line.width,lineSettings.lineWidth);
 assert(paths.every(t=>t.opacity===lineSettings.lineOpacity));
 assert.equal(emphasized.filter(t=>t.meta?.enrollmentAnchor&&t.meta?.enrollmentDirection).length,1,'only the anchor arrow is emphasized');
}
assert.equal(explorationLineTraces(lineModel,positions,{...emphasisSettings,visit:'enrollment'},annotations).length,0);
assert.equal(explorationLineTraces(lineModel,positions,{...emphasisSettings,lines:false},annotations).length,0);
assert(!explorationLineTraces(lineModel,positions,{...emphasisSettings,anchor:'c'},annotations).some(t=>t.meta?.enrollmentAnchor),'no invented path for missing follow-up');
`,context);
console.log('Anchor emphasis: unique identities, fixed coordinates/colors/opacity, visit visibility, moving anchor, doubled lines and Fermat paths, and missing follow-up passed.');

// Anchor navigation follows the filtered dropdown and never wraps or selects its placeholder.
const navControls=new Map(),navEl=id=>{if(!navControls.has(id))navControls.set(id,{});return navControls.get(id)};
navEl('enrollmentAnchor').options=[{value:''},{value:'a'},{value:'excluded',disabled:true},{value:'b'}];navEl('enrollmentAnchor').value='';navEl('enrollmentAnchor').disabled=false;
const nav=vm.createContext({el:navEl,queue:Promise.resolve(),graphQueue:Promise.resolve()});vm.runInContext(source,nav);
const anchorChanges=[];let finishAnchor;
nav.updateExploration=patch=>{anchorChanges.push(patch);navEl('enrollmentAnchor').value=patch.anchor;return new Promise(resolve=>{finishAnchor=resolve})};
nav.syncExplorationControls=()=>{navEl('enrollmentAnchor').disabled=false;nav.syncEnrollmentAnchorNavigation()};
nav.syncEnrollmentAnchorNavigation();assert.equal(navEl('previousEnrollmentAnchor').disabled,true);assert.equal(navEl('nextEnrollmentAnchor').disabled,false);
let moving=nav.stepEnrollmentAnchor(1);assert.equal(navEl('enrollmentAnchor').value,'a');assert.equal(navEl('nextEnrollmentAnchor').disabled,true);
await nav.stepEnrollmentAnchor(1);assert.equal(anchorChanges.length,1,'in-flight navigation cannot queue another anchor');finishAnchor();await moving;
assert.equal(navEl('previousEnrollmentAnchor').disabled,true);moving=nav.stepEnrollmentAnchor(1);finishAnchor();await moving;
assert.equal(navEl('enrollmentAnchor').value,'b');assert.equal(navEl('nextEnrollmentAnchor').disabled,true);assert.equal(navEl('previousEnrollmentAnchor').disabled,false);
await nav.stepEnrollmentAnchor(1);assert.equal(anchorChanges.length,2,'last anchor does not wrap');
moving=nav.stepEnrollmentAnchor(-1);finishAnchor();await moving;assert.equal(navEl('enrollmentAnchor').value,'a');assert.ok(anchorChanges.every(p=>Object.keys(p).join()==='anchor'));
navEl('enrollmentAnchor').disabled=true;nav.syncEnrollmentAnchorNavigation();await nav.stepEnrollmentAnchor(1);assert.equal(anchorChanges.length,3);assert.equal(navEl('nextEnrollmentAnchor').disabled,true);
navEl('enrollmentAnchor').disabled=false;navEl('enrollmentAnchor').options=[{value:''}];nav.syncEnrollmentAnchorNavigation();assert.equal(navEl('previousEnrollmentAnchor').disabled,true);assert.equal(navEl('nextEnrollmentAnchor').disabled,true);
console.log('Enrollment anchor navigation: placeholder, eligibility, previous/next boundaries, disabled mode, empty list and in-flight guard passed.');

// Selecting a visit opens transitions; standard view and unrelated controls do not force it.
const visitRouting=vm.createContext({assert});
vm.runInContext(source+`
const controls=new Map();el=id=>{if(!controls.has(id))controls.set(id,{});return controls.get(id)};
let stateTransitionMode=false,available=true,seen=[];
stateTransitionsAvailable=()=>available;
updateExploration=patch=>{seen.push({patch,mode:stateTransitionMode});return 'updated'};
installExploration();
for(const visit of Object.keys(explorationVisits)){
 stateTransitionMode=false;el('explorationVisit').value=visit;
 assert.equal(el('explorationVisit').onchange(),'updated');
 assert.equal(seen.at(-1).mode,true,'Graph mode is switched before rendering '+visit);
 assert.equal(seen.at(-1).patch.visit,visit);
}
for(const mode of [false,true]){
 stateTransitionMode=mode;el('explorationVisit').value='off';el('explorationVisit').onchange();
 assert.equal(stateTransitionMode,mode,'Standard view leaves the graph choice unchanged');
}
available=false;stateTransitionMode=false;el('explorationVisit').value='enrollment';el('explorationVisit').onchange();
assert.equal(stateTransitionMode,false,'Do not activate an unavailable transition view');
available=true;stateTransitionMode=false;el('enrollmentHighlightColor').value='#abcdef';el('enrollmentHighlightColor').onchange();
assert.equal(stateTransitionMode,false,'Appearance updates respect a manually selected feature graph');
`,visitRouting);
console.log('Visit dropdown routes all highlights to available transitions; standard view and appearance retain graph choice.');
