import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context=vm.createContext({assert});
vm.runInContext(fs.readFileSync(new URL('enrollment_heatmap.js',import.meta.url),'utf8')+`
const matrix={values:[[0,2,4],[2,0,6],[4,6,0]],median:4,p:1,orders:{average:[2,0,1],complete:[1,0,2],single:[0,2,1]}};
const asset={records:[{subject:'a',arm:'Placebo'},{subject:'b',arm:'Azithromycin'},{subject:'c',arm:'Placebo'}],methods:{'l1-euclidean':{ordinary:matrix,fermat11:matrix,fermat125:matrix}}};
const before=JSON.stringify(asset);
let m=enrollmentHeatmapModel(asset,'l1-euclidean','ordinary','average',true);
assert.equal(m.rows.map(r=>r.subject).join(','),'c,a,b');
for(const panel of m.panels){assert.equal(panel.raw[0][1],4);assert.equal(panel.z[0][1],1)}
assert.equal(m.rows[0].arm,'Placebo','treatment strip follows reordered participant');
m=enrollmentHeatmapModel(asset,'l1-euclidean','fermat11','complete',false);
assert.equal(m.rows.map(r=>r.subject).join(','),'b,a,c');assert.equal(m.panels[0].raw[0][2],6);assert.equal(m.panels[0].z[0][2],6);
assert.equal(JSON.stringify(asset),before,'orders and scaling cannot mutate scientific matrices');
assert.equal(enrollmentHeatmapModel(asset,'l1-euclidean','ordinary','none',true).rows[0].subject,'a');
let group=heatmapGroupRange(m.rows,new Set(),1,2);
assert.equal([...group].join(','),'b,a','row ranges follow the current clustering order');
let clicked=heatmapGroupClick(m.rows,group,null,'c',false);assert(clicked.subjects.has('c'));
clicked=heatmapGroupClick(m.rows,clicked.subjects,'c','c',false);assert(!clicked.subjects.has('c'),'click toggles one row only');
clicked=heatmapGroupClick(m.rows,new Set(),'b','c',true);assert.equal(clicked.subjects.size,3,'shift-click includes both boundaries');
assert.equal(JSON.stringify(heatmapSelectionBands([{subject:'a'},{subject:'c'},{subject:'b'}],group)),'[[0,0],[2,2]]','reordering preserves IDs and recomputes highlight bands');
assert.throws(()=>heatmapGroupRange(m.rows,group,0,2));assert.throws(()=>heatmapGroupRange(m.rows,group,1,4));
assert.equal(group.size,2,'range operations do not mutate prior selections');
const fits={};for(const k of [2,3,4])fits['fixed|average|'+k]={labels:[1,1,2],clusters:k,silhouette:k===4?.2:.4,dunn:k===3?.8:.5};
const clustered={clustering:{banks:{'l1-euclidean|ordinary':fits}}};
let settings={method:'fixed',choice:'silhouette',k:4,minK:2,maxK:4};
let fit=heatmapClusterFit(clustered,'l1-euclidean','ordinary','average',settings);
assert.equal(fit.key,'fixed|average|2','exact score ties choose smaller k');assert.equal(fit.best.dunn,3);
fit=heatmapClusterFit(clustered,'l1-euclidean','ordinary','average',{...settings,choice:'dunn'});assert.equal(fit.clusters,3);
assert.equal(heatmapClusterOrder([2,0,3,1],{labels:[2,1,0,1]}).join(','),'3,1,0,2','groups are contiguous, within-group ordering preserved, noise last');
assert.throws(()=>heatmapClusterFit(clustered,'l1-euclidean','ordinary','average',{...settings,minK:8,maxK:2}));
assert.equal(heatmapClusterFit({},'l1-euclidean','ordinary','average',{method:'none'}),null);
assert.throws(()=>heatmapClusterFit({},'l1-euclidean','ordinary','average',settings));
assert.throws(()=>enrollmentHeatmapModel(asset,'bad','ordinary','average',true));
assert.throws(()=>enrollmentHeatmapModel(asset,'l1-euclidean','ordinary','ward',true));
`,context);
console.log('Heatmap shared ordering, treatment alignment, raw/scaled values, invalid options and immutable inputs passed.');

// Live selections update the paired view without closing or replacing the dock.
const live=vm.createContext({assert});
await vm.runInContext(fs.readFileSync(new URL('enrollment_heatmap.js',import.meta.url),'utf8')+`
(async()=>{
const elements=new Map();el=id=>{if(!elements.has(id))elements.set(id,{value:'',hidden:false,classList:{toggle(){}}});return elements.get(id)};
let asset={datasetRevision:'r',analysisRevision:'a',inputSha256:'x',records:[{subject:'a'},{subject:'b'},{subject:'c'}]};
enrollmentHeatmapAsset=()=>asset;
let active=false,updates=[];
baselineExplore={visit:'off',subjects:null,path:'fermat125',arrows:true};
explorationActive=()=>active;
updateExploration=async patch=>{updates.push(patch);baselineExplore={...baselineExplore,...patch};active=true};
el('heatmapSelectCluster').options=['','1','2','0'].map(value=>({value}));
el('heatmapSelectCluster').disabled=false;
syncHeatmapSelection=async()=>syncHeatmapClusterPicker();
enrollmentHeatmapCluster={labels:[1,2,1]};
await selectHeatmapCluster(1);
assert.equal(el('heatmapSelectCluster').value,'1','Cluster selection survives commit');
assert.equal(el('previousHeatmapCluster').disabled,true);
await stepHeatmapCluster(1);assert.equal(el('heatmapSelectCluster').value,'2');
await stepHeatmapCluster(-1);assert.equal(el('heatmapSelectCluster').value,'1');
assert.deepEqual([...baselineExplore.subjects],['a','c']);assert.equal(baselineExplore.visit,'paired');
assert.equal(baselineExplore.treatment,true);assert.equal(baselineExplore.path,'fermat125');assert.equal(baselineExplore.arrows,true);
baselineExplore.visit='enrollment';baselineExplore.lines=false;baselineExplore.treatment=false;
enrollmentHeatmapSelection.subjects=new Set(['b']);await commitHeatmapSelection();
assert.equal(baselineExplore.visit,'enrollment','Subsequent selections preserve visit and appearance controls');
assert.equal(baselineExplore.lines,false);assert.equal(baselineExplore.treatment,false);
enrollmentHeatmapSelection.subjects=new Set(['a']);await commitHeatmapSelection();
assert.equal(el('heatmapSelectCluster').value,'','Partial cluster is a custom selection');
enrollmentHeatmapCluster={labels:[2,1,2]};syncHeatmapClusterPicker();
assert.equal(el('heatmapSelectCluster').value,'','Changing labels does not silently select a different group');
enrollmentHeatmapSelection.subjects=new Set(['a','c']);syncHeatmapClusterPicker();
assert.equal(el('heatmapSelectCluster').value,'2','Restored exact membership follows new labels');
enrollmentHeatmapCluster={labels:[1,0,1]};await selectHeatmapCluster(0);
assert.equal(el('heatmapSelectCluster').value,'0','Noise is a selectable group');
assert.equal(el('nextHeatmapCluster').disabled,true,'Navigation stops after noise');
assert.equal(heatmapClusterStep(['1','2','0'],'',1),'1');
assert.equal(heatmapClusterStep(['1','2','0'],'',-1),'0');
assert.equal(heatmapClusterStep(['1','2'],'2',1),null);
assert.equal(heatmapClusterStep([],'',1),null);
enrollmentHeatmapCluster=null;syncHeatmapClusterPicker();assert.equal(el('heatmapSelectCluster').value,'');
el('heatmapSelectCluster').disabled=true;syncHeatmapClusterPicker();
assert.equal(el('previousHeatmapCluster').disabled,true);assert.equal(el('nextHeatmapCluster').disabled,true);
enrollmentHeatmapSelection.subjects.clear();await commitHeatmapSelection();assert.equal(baselineExplore.subjects,null);
heatmapDockReady=true;META={id:'sante-16s'};assert.equal(syncEnrollmentHeatmapPanel(),true);
assert.equal(el('enrollmentHeatmapPanel').hidden,false);assert.equal(el('catalogueTitle').textContent,'Enrollment distance heatmap');
baselineExplore.subjects=['c'];syncEnrollmentHeatmapPanel();assert.deepEqual([...enrollmentHeatmapSelection.subjects],['c'],'Restored views synchronize by participant ID');
active=false;assert.equal(syncEnrollmentHeatmapPanel(),false);assert.equal(el('enrollmentHeatmapPanel').hidden,true);
active=true;heatmapDockDismissed=true;assert.equal(syncEnrollmentHeatmapPanel(),false);
META.id='other';asset=null;assert.equal(syncEnrollmentHeatmapPanel(),false);
})();`,live);
console.log('Live cluster/sample selection, clearing, retained appearance, restored groups and catalogue routing passed.');

const sizedPlot={clientWidth:1692,style:{}},sizes=[];
const sizing=vm.createContext({el:()=>sizedPlot,Plotly:{relayout:async(plot,update)=>sizes.push(update)}});
vm.runInContext(fs.readFileSync(new URL('enrollment_heatmap.js',import.meta.url),'utf8'),sizing);
await vm.runInContext('resizeEnrollmentHeatmap()',sizing);
assert.equal(sizes.at(-1).width,1692);assert.equal(sizedPlot.style.height,'659px');
sizedPlot.clientWidth=604;await vm.runInContext('resizeEnrollmentHeatmap()',sizing);
assert.equal(sizes.at(-1).width,604);assert.equal(sizedPlot.style.height,'351px');
console.log('Heatmap explicitly resizes both dimensions on maximize and restore.');

// Render all three panels and exercise column-strip selection, including noise.
await vm.runInContext(fs.readFileSync(new URL('enrollment_heatmap.js',import.meta.url),'utf8')+`
(async()=>{
const elements=new Map(),events={};
el=id=>{if(!elements.has(id))elements.set(id,{value:'',style:{},clientWidth:900,checked:true,removeAllListeners(){},on(name,fn){events[name]=fn}});return elements.get(id)};
for(const [id,value] of Object.entries({heatmapMetric:'l1-euclidean',heatmapOrderDistance:'ordinary',heatmapLinkage:'average',heatmapScale:'median'}))el(id).value=value;
const matrix={values:[[0,2,4],[2,0,6],[4,6,0]],median:4,p:1,orders:{average:[2,0,1]}};
const asset={records:[{subject:'a',arm:'Placebo'},{subject:'b',arm:'Azithromycin'},{subject:'c',arm:'Placebo'}],methods:{'l1-euclidean':{ordinary:matrix,fermat11:matrix,fermat125:matrix}}};
enrollmentHeatmapAsset=()=>asset;
let method='fixed';heatmapClusterSettings=()=>({method});syncHeatmapClusterControls=()=>{};
heatmapClusterFit=()=>method==='none'?null:{labels:[2,0,1],clusters:2};
renderHeatmapClusterResults=async()=>{};syncHeatmapSelection=async()=>{};
explorationArms={Azithromycin:'#ff0000',Placebo:'#0000ff'};
let drawn;Plotly={react:async(plot,traces,layout)=>{drawn={traces,layout}}};
let chosen=null;selectHeatmapCluster=id=>{chosen=id};
for(method of ['fixed','dynamic','hdbscan']){
 await drawEnrollmentHeatmap();
 const tops=drawn.traces.filter(t=>t.meta?.orientation==='horizontal'),sides=drawn.traces.filter(t=>t.meta?.orientation==='vertical');
 assert.equal(tops.length,3);assert.equal(sides.length,3);
 for(let i=0;i<3;i++){
  const top=tops[i],side=sides[i],matrix=drawn.traces.filter(t=>t.colorscale==='Viridis')[i];
  assert.deepEqual(top.x,matrix.x,'Strip follows the displayed columns');
  assert.deepEqual(top.z[0],side.z.map(r=>r[0]),'Top and side labels align');
  assert.deepEqual(top.colorscale,side.colorscale,'Same colors on both axes');
  assert.equal(top.colorscale[0][1],'#999999','Noise is gray');
  assert.equal(top.xaxis,matrix.xaxis,'Zoom preserves column alignment');
  const suffix=i?String(i+1):'';
  assert(drawn.layout['yaxis'+suffix].domain[1]<drawn.layout['yaxis'+(i+4)].domain[0],'Strip has its own space above the matrix');
  events.plotly_click({points:[{data:top,x:'a · Placebo',y:'Cluster'}]});assert.equal(chosen,2);
  events.plotly_click({points:[{data:top,x:'b · Azithromycin',y:'Cluster'}]});assert.equal(chosen,0);
  events.plotly_click({points:[{data:side,x:'Cluster',y:'c · Placebo'}]});assert.equal(chosen,1,'Existing side selection still works');
 }
}
method='none';await drawEnrollmentHeatmap();
assert.equal(drawn.traces.filter(t=>t.meta?.clusterStripe).length,0,'No cluster strips without clustering');
assert.deepEqual(drawn.layout.yaxis.domain,[0,1],'Unclustered matrix retains full height');
})();`,vm.createContext({assert}));
console.log('Top cluster strips align across all panels, share colors, select clusters/noise, and disappear without clustering.');

// Validate ZIP interoperability and all exported real assignments independently.
const {spawnSync}=await import('node:child_process');
const {tmpdir}=await import('node:os');
const {join}=await import('node:path');
const exportDir=fs.mkdtempSync(join(tmpdir(),'vme-clustering-export-'));
const archiveContext=vm.createContext({TextEncoder,Blob,Response,CompressionStream,setTimeout});
vm.runInContext(fs.readFileSync(new URL('enrollment_heatmap.js',import.meta.url),'utf8'),archiveContext);
for(const compressed of [false,true]){
 archiveContext.compressed=compressed;
 const blob=await vm.runInContext("heatmapZip([{name:'unicode-α.csv',text:heatmapCsv([['a','b'],['quoted, value','a\\\"b'],['line\\nbreak',null]])}],()=>{},compressed)",archiveContext);
 fs.writeFileSync(join(exportDir,compressed?'compressed.zip':'stored.zip'),Buffer.from(await blob.arrayBuffer()));
}
const assetPath=new URL('enrollment_heatmap.json',import.meta.url);
if(fs.existsSync(assetPath)){
 const asset=JSON.parse(fs.readFileSync(assetPath,'utf8')),original=JSON.stringify(asset);
 archiveContext.asset=asset;
 const blob=await vm.runInContext("heatmapZip(heatmapClusteringFiles(asset,{clustering:{method:'none'},highlightedParticipants:1},'2026-10-28T00:00:00Z'))",archiveContext);
 assert.equal(JSON.stringify(asset),original,'Export cannot mutate the saved supplement');
 fs.writeFileSync(join(exportDir,'all.zip'),Buffer.from(await blob.arrayBuffer()));
}
const check=spawnSync('python3',['-c',String.raw`
import csv,io,json,sys,zipfile
from pathlib import Path
root=Path(sys.argv[1]); source=Path(sys.argv[2])
for name in ('stored.zip','compressed.zip'):
 with zipfile.ZipFile(root/name) as z:
  assert z.testzip() is None
  rows=list(csv.reader(io.StringIO(z.read('unicode-α.csv').decode())))
  assert rows==[['a','b'],['quoted, value','a"b'],['line\nbreak','']]
if (root/'all.zip').exists():
 a=json.loads(source.read_text())
 with zipfile.ZipFile(root/'all.zip') as z:
  assert z.testzip() is None
  assert len(z.namelist())==len(set(z.namelist()))
  read=lambda name:list(csv.DictReader(io.StringIO(z.read(name).decode())))
  index=read('clustering_index.csv'); manifest=json.loads(z.read('manifest.json'))
  assert manifest['clusterings']==len(index)==sum(map(len,a['clustering']['banks'].values()))
  assert manifest['files']==len(z.namelist())
  assert json.loads(z.read('saved-data.json'))==a
  assert 'not restricted to the selected cluster' in z.read('README.md').decode()
  participants=read('participants.csv')
  assert len(participants)==len(a['records'])
  for i,(r,original) in enumerate(zip(participants,a['records'])):
   assert int(r['participant_index'])==i+1 and r['participant_id']==original['subject'] and r['sample_id']==original['id']
   assert r['treatment_assignment']==original['arm']
   assert r['earlier_day_doses']=='' if original['priorDoses'] is None else float(r['earlier_day_doses'])==original['priorDoses']
  all_sizes={}
  for r in read('cluster_sizes.csv'): all_sizes.setdefault(r['clustering_id'],{})[int(r['cluster'])]=r
  for r in index:
   fit=a['clustering']['banks'][r['geometry']+'|'+r['distance']][r['clustering_id'].split('|',2)[2]]
   rows=read(r['assignment_file']);assert len(rows)==len(a['records'])
   for i,row in enumerate(rows):
    assert int(row['participant_index'])==i+1 and row['sample_id']==a['records'][i]['id']
    label=int(row['cluster']);assert label==fit['labels'][i]
    assert row['assignment_status']==('assigned' if label else 'unassigned/noise')
   assert int(r['clusters'])==fit['clusters'] and int(r['unassigned_n'])==fit['unassigned']
   for field,key in [('mean_silhouette','silhouette'),('dunn','dunn')]:
    assert r[field]=='' if fit[key] is None else float(r[field])==fit[key]
   sizes=all_sizes[r['clustering_id']]
   assert sum(int(s['n']) for s in sizes.values())==len(rows)
   for label,s in sizes.items():
    assert int(s['n'])==fit['labels'].count(label)
    assert abs(float(s['percent_of_all_enrollment'])-100*int(s['n'])/len(rows))<1e-10
  for geometry,methods in a['methods'].items():
   for distance,m in methods.items():
    rows=read(f'distances/{geometry}/{distance}.csv');assert len(rows)==len(a['records'])
    for i,row in enumerate(rows):
     assert int(row['participant_index'])==i+1
     assert [float(row[str(j+1)]) for j in range(len(rows))]==m['values'][i]
    ranks=read(f'orders/{geometry}/{distance}.csv')
    for linkage,order in m['orders'].items():
     for rank,i in enumerate(order): assert int(ranks[i][linkage+'_rank'])==rank+1
 print(f"PASS: {len(index)} clustering CSVs, participant identities, scores, noise, sizes, all distance matrices, ranks and complete saved data; {manifest['files']} files.")
print('PASS: compressed/stored ZIP CRCs, UTF-8 filenames and CSV quoting.')
`,exportDir,assetPath.pathname],{encoding:'utf8',maxBuffer:1024*1024});
assert.equal(check.status,0,check.stderr||check.stdout);console.log(check.stdout.trim());
