// Enrollment neighborhoods are defined in full abundance space, never in 3D or by CST.
const explorationVisits={all:'All visits',enrollment:'Enrollment',followup:'Follow-up',paired:'Enrollment + follow-up',delivery:'Delivery'};
const explorationMetrics={'l1-euclidean':'L1-normalized · Euclidean','max-euclidean':'Max-normalized · Euclidean','max-linf':'Max-normalized · L∞'};
const explorationPathTypes={straight:'Straight line',fermat11:'Fermat p = 1.1',fermat125:'Fermat p = 1.25'};
const explorationArms={Azithromycin:'#0072b2',Placebo:'#d55e00'};
const explorationAppearanceControls=[
 ['highlightSize','Highlighted visit size',1,16,1,6],
 ['highlightOpacity','Highlighted visit opacity',0,100,100,.7],
 ['contextSize','Gray background size',1,16,1,2],
 ['contextOpacity','Gray background opacity',0,100,100,.28],
 ['lineWidth','Connecting line thickness',1,16,1,3],
 ['lineOpacity','Connecting line opacity',0,100,100,.6]
];
const explorationAppearanceDefaults=()=>Object.fromEntries(explorationAppearanceControls.map(([key,,,,,value])=>[key,value]));
function loadExplorationAppearance(){
 const values={...explorationAppearanceDefaults(),arrows:false};
 try{const saved=JSON.parse(datasetPanelStorage.getItem('vme-visit-highlight-appearance-v1'));
  if(typeof saved?.arrows==='boolean')values.arrows=saved.arrows;
  for(const [key,,min,max,scale] of explorationAppearanceControls)if(Number.isFinite(saved?.[key])&&saved[key]*scale>=min&&saved[key]*scale<=max)values[key]=saved[key];
 }catch{}
 return values;
}
function updateExplorationAppearance(key,value){
 const control=explorationAppearanceControls.find(c=>c[0]===key);if(!control||!Number.isFinite(value))return;
 const [,,min,max,scale]=control;baselineExplore[key]=Math.max(min,Math.min(max,value))/scale;
 saveExplorationAppearance();
 syncExplorationControls();
 if(explorationActive())return refreshSamples(readCamera('samples'));
}
function saveExplorationAppearance(){
 try{datasetPanelStorage.setItem('vme-visit-highlight-appearance-v1',JSON.stringify({...Object.fromEntries(explorationAppearanceControls.map(([k])=>[k,baselineExplore[k]])),arrows:!!baselineExplore.arrows}))}catch{}
}
function updateExplorationArrows(value){
 baselineExplore.arrows=!!value;saveExplorationAppearance();syncExplorationControls();
 if(explorationActive())return refreshSamples(readCamera('samples'));
}
const explorationDefaults=()=>({dataset:null,visit:'off',nearby:false,anchor:'',k:20,metric:'l1-euclidean',pairedOnly:false,lines:true,arrows:false,path:'straight',treatment:false,color:'#0072b2',subjects:null,...explorationAppearanceDefaults()});
let baselineExplore=explorationDefaults(),explorationRendered=null;
function explorationAvailable(){return META.id==='sante-16s'&&!!participantData()?.compositions&&!!DATA.records}
function explorationActive(){return explorationAvailable()&&baselineExplore.dataset===META.id&&baselineExplore.visit!=='off'&&!participant.active&&selected===null&&selectedVertex===null&&!rank3UsesSamples()&&!pureCoverageActive()}
function explorationSnapshot(){return explorationActive()?{...baselineExplore}:null}
function explorationRestore(s){baselineExplore=s?{...explorationDefaults(),...s}:explorationDefaults();syncExplorationControls()}
function explorationValidate(s,bundle){
 if(!s)return;
 if(s.dataset!=='sante-16s'||bundle.dataset.id!==s.dataset||!explorationVisits[s.visit]||!explorationMetrics[s.metric]||!Number.isInteger(s.k)||s.k<1||s.k>500||['nearby','pairedOnly','lines','treatment'].some(k=>typeof s[k]!=='boolean'))throw Error('Invalid saved enrollment exploration');
 if(s.path!==undefined&&(!explorationPathTypes[s.path]||s.path!=='straight'&&!BUNDLE_PACK.trajectoryPaths?.[s.dataset]))throw Error('Saved connecting path is unavailable');
 if(s.arrows!==undefined&&typeof s.arrows!=='boolean')throw Error('Invalid saved trajectory arrow setting');
 if(s.color!=null&&!/^#[0-9a-f]{6}$/i.test(s.color))throw Error('Invalid visit highlight color');
 for(const [key,,min,max,scale] of explorationAppearanceControls)if(s[key]!==undefined&&(!Number.isFinite(s[key])||s[key]*scale<min||s[key]*scale>max))throw Error('Invalid saved visit appearance: '+key);
 const p=BUNDLE_PACK.participants[s.dataset];
 if(s.subjects!=null){const eligible=new Set(p.records.filter(r=>r.originalVisit==='enrollment_ANC').map(r=>r.subject));if(!Array.isArray(s.subjects)||!s.subjects.length||new Set(s.subjects).size!==s.subjects.length||s.subjects.some(id=>typeof id!=='string'||!eligible.has(id))||s.nearby)throw Error('Invalid saved heatmap participant group')}

 if(s.nearby&&!p?.records.some(r=>r.subject===s.anchor&&r.originalVisit==='enrollment_ANC'))throw Error('Saved enrollment anchor unavailable');
}
function explorationMetadata(){const a=BUNDLE_PACK.participantExploration?.[META.id];return a?.datasetRevision===META.revision&&a.analysisRevision===participantData()?.analysisRevision?a:null}
function explorationPathAsset(){const a=BUNDLE_PACK.trajectoryPaths?.[META.id];return a?.datasetRevision===META.revision&&a.analysisRevision===participantData()?.analysisRevision?a:null}
function explorationPathBank(){
 const method={'maxnorm-euclidean':'max-euclidean','maxnorm-linf':'max-linf'}[maxNormalizedMethod()]||'l1-euclidean';
 return explorationPathAsset()?.methods[method]?.[baselineExplore.path];
}
function updateExplorationPath(value){
 if(!explorationPathTypes[value]||value!=='straight'&&!explorationPathAsset())return;
 baselineExplore.path=value;syncExplorationControls();if(explorationActive())return refreshSamples(readCamera('samples'));
}
function explorationStage(r){return {enrollment_ANC:'enrollment',follow_up_ANC:'followup',delivery:'delivery'}[r.originalVisit]||null}
function explorationIndex(records){
 const groups=new Map();
 for(const r of records){if(!r.subject)continue;const key=participantKey(r);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}
 return [...groups].map(([key,rows])=>{const e=rows.filter(r=>explorationStage(r)==='enrollment'),f=rows.filter(r=>explorationStage(r)==='followup');return {key,subject:rows[0].subject,rows,enrollment:e.length===1?e[0]:null,followup:f.length===1?f[0]:null,ambiguous:e.length>1||f.length>1}});
}
function explorationDistance(a,b,metric){
 const maxnorm=metric!=='l1-euclidean',sa=maxnorm?Math.max(...a.map(v=>v[1])):1,sb=maxnorm?Math.max(...b.map(v=>v[1])):1;
 if(!(sa>0&&sb>0))throw Error('Invalid zero abundance profile');
 const delta=new Map(a.map(([i,v])=>[i,v/sa]));for(const [i,v] of b)delta.set(i,(delta.get(i)||0)-v/sb);
 const values=[...delta.values()];return metric==='max-linf'?Math.max(0,...values.map(Math.abs)):Math.sqrt(values.reduce((s,v)=>s+v*v,0));
}
function explorationModel(records,compositions,settings){
 const groups=explorationIndex(records),pool=groups.filter(g=>g.enrollment&&!g.ambiguous&&(!settings.pairedOnly||g.followup));
 let chosen=settings.pairedOnly?groups.filter(g=>g.enrollment&&g.followup&&!g.ambiguous):groups,ranked=[],cutoff=null;
 if(settings.subjects!=null){const ids=new Set(settings.subjects);chosen=chosen.filter(g=>g.enrollment&&!g.ambiguous&&ids.has(g.subject))}
 if(settings.nearby){
  const anchor=pool.find(g=>g.subject===settings.anchor);
  if(!anchor)return {groups,pool,chosen:[],rows:[],context:records,ranked,cutoff,error:'Choose an enrollment participant eligible for the current pair filter.'};
  ranked=pool.filter(g=>g!==anchor).map(g=>({...g,distance:explorationDistance(compositions[anchor.enrollment.profile],compositions[g.enrollment.profile],settings.metric)})).sort((a,b)=>a.distance-b.distance||a.key.localeCompare(b.key));
  cutoff=ranked[Math.min(settings.k,ranked.length)-1]?.distance??0;
  chosen=[{...anchor,distance:0},...ranked.filter(g=>g.distance<=cutoff+1e-12*Math.max(1,cutoff))];
 }
 const accepts=r=>settings.visit==='all'||settings.visit==='paired'&&['enrollment','followup'].includes(explorationStage(r))||explorationStage(r)===settings.visit;
 const rows=chosen.flatMap(g=>g.rows.filter(accepts)),highlighted=new Set(rows);
 return {groups,pool,chosen,rows,context:records.filter(r=>!highlighted.has(r)),ranked,cutoff};
}
let enrollmentAnchorBusy=false;
function enrollmentAnchorChoices(){return [...el('enrollmentAnchor').options].filter(o=>o.value&&!o.disabled).map(o=>o.value)}
function syncEnrollmentAnchorNavigation(){
 const picker=el('enrollmentAnchor'),keys=enrollmentAnchorChoices(),position=keys.indexOf(picker.value);
 el('previousEnrollmentAnchor').disabled=picker.disabled||enrollmentAnchorBusy||position<=0;
 el('nextEnrollmentAnchor').disabled=picker.disabled||enrollmentAnchorBusy||!keys.length||position===keys.length-1;
}
async function stepEnrollmentAnchor(direction){
 const picker=el('enrollmentAnchor');if(picker.disabled||enrollmentAnchorBusy)return;
 const keys=enrollmentAnchorChoices(),index=keys.indexOf(picker.value)+direction;
 if(index<0||index>=keys.length)return;
 enrollmentAnchorBusy=true;syncEnrollmentAnchorNavigation();
 try{await updateExploration({anchor:keys[index]});await Promise.all([queue,graphQueue])}
 catch(error){el('enrollmentExploreStatus').textContent=error.message||String(error)}
 finally{enrollmentAnchorBusy=false;syncExplorationControls()}
}
function syncExplorationControls(){
 el('sampleColorScheme').disabled=false;
 const available=explorationAvailable();el('enrollmentExploreControls').hidden=!available;el('enrollmentExploreSection').hidden=!available;el('openEnrollmentHeatmap').disabled=!enrollmentHeatmapAsset();if(!available){syncEnrollmentHeatmapPanel();return;}
 if(baselineExplore.dataset!==META.id)baselineExplore={...explorationDefaults(),...loadExplorationAppearance(),dataset:META.id};
 if(explorationActive())el('headerClearSelection').disabled=false;
 const s=baselineExplore;el('sampleColorScheme').disabled=explorationActive();el('enrollmentHighlightColor').value=s.color||explorationDefaults().color;el('enrollmentHighlightColor').disabled=s.treatment&&!!explorationMetadata();const p=participantData(),groups=explorationIndex(p.records),pool=groups.filter(g=>g.enrollment&&!g.ambiguous&&(!s.pairedOnly||g.followup)).sort((a,b)=>a.subject.localeCompare(b.subject));
 for(const [key,,min,max,scale] of explorationAppearanceControls){const value=s[key]??explorationAppearanceDefaults()[key];el('enrollment'+key).value=value*scale;el('enrollment'+key).disabled=!explorationActive()||key.startsWith('line')&&(!s.lines||!['paired','all'].includes(s.visit));el('enrollment'+key).title=key.startsWith('line')?'Choose Enrollment + follow-up or All visits and enable Connect enrollment to follow-up.':'';el('enrollment'+key+'Value').textContent=Math.round(value*scale)+(scale===100?'%':' px')}
 const picker=el('enrollmentAnchor'),signature=pool.map(g=>g.key).join('|');
 if(picker.dataset.signature!==signature){picker.innerHTML='<option value="">Choose an enrollment participant…</option>'+pool.map(g=>`<option value="${esc(g.subject)}">${esc(g.subject)}${g.followup?'':' · no follow-up'}</option>`).join('');picker.dataset.signature=signature}
 el('clearHeatmapGroup').hidden=!s.subjects?.length;
 el('explorationVisit').value=s.visit;el('enrollmentNearby').checked=s.nearby;picker.value=s.anchor;picker.disabled=!s.nearby||enrollmentAnchorBusy;syncEnrollmentAnchorNavigation();
 el('enrollmentNeighbors').value=s.k;el('enrollmentNeighbors').disabled=!s.nearby;
 el('enrollmentDistance').value=s.metric;el('enrollmentDistance').disabled=!s.nearby;
 el('enrollmentPairedOnly').checked=s.pairedOnly;el('enrollmentLines').checked=s.lines;el('enrollmentLines').disabled=s.visit!=='paired'&&s.visit!=='all';
 const pathSelect=el('enrollmentPath');pathSelect.value=s.path||'straight';pathSelect.disabled=!explorationActive()||!s.lines||!['all','paired'].includes(s.visit);for(const option of pathSelect.options)option.disabled=option.value!=='straight'&&!explorationPathAsset();
 el('enrollmentArrows').checked=!!s.arrows;el('enrollmentArrows').disabled=!explorationActive()||!s.lines||!['all','paired'].includes(s.visit);
 el('enrollmentTreatment').checked=s.treatment;el('enrollmentTreatment').disabled=!explorationMetadata();el('exportEnrollmentNeighborhood').disabled=!explorationActive();
 syncEnrollmentHeatmapPanel();
 if(!explorationActive())el('enrollmentExploreStatus').textContent='Choose visits to highlight against all samples. Neighborhoods use enrollment profiles; graph selection and individual Participant mode return to the standard view.';
}
function explorationCoordinates(){
 const b=datasetRegistry.get(META.id),method=maxNormalizedMethod();
 if(maxNormalizedMethods.includes(method)){const bank=datasetMaxNormalizedAsset(),fit=datasetMaxNormalizedFit(bank.globals.all,method);return new Map(fit.profiles.map((p,i)=>[p,fit.coordinates[i]]))}
 const a=b.cohortAnalysis,fit=a.fits[a.specs['all|merged|100'].global];
 return new Map(fit.profileIndices.map((p,i)=>[p,fit.profileCoords[i]]));
}
function explorationHover(r){const m=explorationMetadata()?.records[r.id];return samplePlotHover(r.index)+'<br>Participant: '+esc(r.subject)+' · '+esc(r.label)+(m?'<br>Assignment: '+esc(m.arm)+'<br>Collection date: '+(m.date||'Unavailable')+'<br>Earlier-day study-product doses: '+(m.priorDoses??'Unavailable')+'<br>Days since earlier-day dose: '+(m.daysSinceDose??'Not available / no prior dose'):'')}
// A small cone inside the last nonzero segment points toward the follow-up.
// Batch cones into one mesh per color so many participants do not add many traces.
function explorationArrowMesh(paths,span,color,opacity,width){
 const mesh={type:'mesh3d',x:[],y:[],z:[],i:[],j:[],k:[],color,opacity,flatshading:false,lighting:{ambient:1,diffuse:0,specular:0},hoverinfo:'skip',showlegend:false,meta:{enrollmentDirection:true}};
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 for(const path of paths){
  const b=path.at(-1);let a;for(let t=path.length-2;t>=0;t--){if(Math.hypot(...b.map((v,j)=>v-path[t][j]))>0){a=path[t];break}}
  if(!a)continue;
  const delta=b.map((v,j)=>v-a[j]),length=Math.hypot(...delta),direction=delta.map(v=>v/length);
  const height=Math.min(span*.018*Math.sqrt(width/3),length*.15),radius=height*.38;
  if(!(height>0))continue;
  const perpendicular=cross(direction,Math.abs(direction[2])<.9?[0,0,1]:[0,1,0]),norm=Math.hypot(...perpendicular),u=perpendicular.map(v=>v/norm),v=cross(direction,u);
  const tip=a.map((x,j)=>x+.78*delta[j]),base=tip.map((x,j)=>x-height*direction[j]),offset=mesh.x.length;
  const points=[tip,base,...Array.from({length:8},(_,k)=>base.map((x,j)=>x+radius*(Math.cos(k*Math.PI/4)*u[j]+Math.sin(k*Math.PI/4)*v[j])))];
  for(const p of points)for(const [j,axis] of ['x','y','z'].entries())mesh[axis].push(p[j]);
  for(let k=0;k<8;k++){const next=(k+1)%8;mesh.i.push(offset,offset+1);mesh.j.push(offset+2+k,offset+2+next);mesh.k.push(offset+2+next,offset+2+k)}
 }
 return mesh.x.length?mesh:null;
}
function explorationIsAnchor(subject,s){return !!s.nearby&&!!s.anchor&&subject===s.anchor}
function explorationLineTraces(model,positions,s,metadata,routeBank=null){
 const traces=[],all=[...positions.values()],span=Math.max(...[0,1,2].map(j=>Math.max(...all.map(p=>p[j]))-Math.min(...all.map(p=>p[j]))));
 if(s.lines&&['all','paired'].includes(s.visit))for(const anchor of [false,true])for(const arm of Object.keys(explorationArms)){
  const width=s.lineWidth*(anchor?2:1);
  const lines={x:[],y:[],z:[]},paths=[];let n=0;
  for(const g of model.chosen){if(explorationIsAnchor(g.subject,s)!==anchor||!g.enrollment||!g.followup||metadata?.records[g.enrollment.id]?.arm!==arm)continue;
   let profiles=[g.enrollment.profile,g.followup.profile];
   if(s.path&&s.path!=='straight'){
    const route=routeBank?.paths[g.key];
    if(!route||route.profiles[0]!==profiles[0]||route.profiles.at(-1)!==profiles[1])throw Error('Fermat path is unavailable for this enrollment–follow-up pair');
    profiles=route.profiles;
   }
   const path=profiles.map(profile=>positions.get(profile));
   if(path.some(p=>!p||p.length!==3||!p.every(Number.isFinite)))throw Error('Connecting path has missing embedding coordinates');
   paths.push(path);for(const [j,axis] of ['x','y','z'].entries())lines[axis].push(...path.map(p=>p[j]),null);n++}
  if(s.arrows){const arrow=explorationArrowMesh(paths,span,s.treatment?explorationArms[arm]:s.color||explorationDefaults().color,s.lineOpacity,width);if(arrow){if(anchor)arrow.meta.enrollmentAnchor=true;traces.push(arrow)}}
  if(n)traces.push({type:'scatter3d',mode:'lines',...lines,line:{color:s.treatment?explorationArms[arm]:s.color||explorationDefaults().color,width},opacity:s.lineOpacity,hoverinfo:'skip',showlegend:false,...(anchor?{meta:{enrollmentAnchor:true}}:{})});
 }
 return traces;
}
// Reference vertices use the same fixed population coordinates as the sample layer,
// regardless of the highlighted visits or participants. Shared appearance controls
// hide/show this layer; reference markers never enter sample counts.
function explorationReferences(nodes,records,positions){
 const grouped=new Map();
 for(const node of nodes){
  const record=records[node.anchor_row],coords=record&&positions.get(record.profile);
  if(!coords||coords.length!==3||!coords.every(Number.isFinite))continue;
  if(!grouped.has(record.profile))grouped.set(record.profile,{coords,features:[],labels:[],sample:record.id});
  const anchor=grouped.get(record.profile);anchor.features.push(node.id);anchor.labels.push(`${node.label} (${fmt(node.maximum)}%)`);
 }
 const anchors=[...grouped.values()],annotations=[];
 anchors.forEach((a,k)=>a.features.forEach((feature,j)=>annotations.push({x:a.coords[0],y:a.coords[1],z:a.coords[2],text:esc(a.labels[j]),name:'endpoint-vertex:'+feature,captureevents:true,showarrow:false,xanchor:[0,3].includes(k%4)?'right':'left',yanchor:k%2?'top':'bottom',xshift:[0,3].includes(k%4)?-12:12,yshift:(k%2?-1:1)*(12+18*j),bgcolor:'rgba(255,255,255,0.85)',font:{family:'Arial, sans-serif',size:12,color:'#24414c'}})));
 const traces=anchors.length?[{type:'scatter3d',mode:'markers',meta:{referenceVertices:true},x:anchors.map(a=>a.coords[0]),y:anchors.map(a=>a.coords[1]),z:anchors.map(a=>a.coords[2]),customdata:anchors.map(a=>'endpoint-vertices:'+a.features.join(',')),text:anchors.map(a=>`${esc(a.labels.join(' + '))}<br>Reference sample: ${esc(a.sample)}<br>Full-population reference; independent of visit highlighting. Reference markers are not counted as additional samples.`),marker:{size:8,symbol:'diamond',color:'#24414c',line:{color:'#ffffff',width:1}},hovertemplate:'%{text}<extra></extra>',showlegend:false}]:[];
 return {traces,annotations};
}
function explorationVisitTraces(rows,positions,s,metadata){
 const traces=[];
 // Partition rather than overlay samples: anchor emphasis must not duplicate identities/counts.
 for(const stage of ['enrollment','followup','delivery'])for(const anchor of [false,true]){
  const part=rows.filter(r=>explorationStage(r)===stage&&explorationIsAnchor(r.subject,s)===anchor);if(!part.length)continue;
  traces.push({type:'scatter3d',mode:'markers',...Object.fromEntries(['x','y','z'].map((axis,j)=>[axis,part.map(r=>positions.get(r.profile)[j])])),meta:{sampleView:sampleViewKey(),enrollmentExploration:true,...(anchor?{enrollmentAnchor:true}:{})},ids:part.map(r=>String(r.index)),customdata:part.map(r=>'enrollment-explore:'+r.subject),text:part.map(r=>(anchor?'<b>Enrollment anchor participant</b><br>':'')+explorationHover(r)),marker:{size:s.highlightSize*(anchor?2:1),...(anchor?{line:{color:'#162e39',width:2}}:{}),symbol:stage==='enrollment'?'circle':stage==='followup'?'diamond':'square',color:part.map(r=>s.treatment&&metadata?explorationArms[metadata.records[r.id].arm]:s.color||explorationDefaults().color),opacity:s.highlightOpacity},hovertemplate:'%{text}<extra></extra>',showlegend:false});
 }
 return traces;
}
function explorationSamples(){
 const s=baselineExplore,p=participantData(),model=explorationModel(p.records.filter(r=>activeCohort==='all'||r.cohort===activeCohort),p.compositions,s),metadata=explorationMetadata(),positions=explorationCoordinates(),rows=model.rows;
 explorationRendered=model;
 const xyz=rs=>({x:rs.map(r=>positions.get(r.profile)[0]),y:rs.map(r=>positions.get(r.profile)[1]),z:rs.map(r=>positions.get(r.profile)[2])});
 const allPositions=[...positions.values()],axes=Object.fromEntries(['xaxis','yaxis','zaxis'].map((axis,j)=>{const v=allPositions.map(p=>p[j]),lo=Math.min(...v),hi=Math.max(...v),pad=(hi-lo||1)*.04;return [axis,{visible:false,autorange:false,range:[lo-pad,hi+pad]}]}));
 const references=explorationReferences(current().nodes,DATA.records,positions),traces=[];
 if(model.context.length)traces.push({type:'scatter3d',mode:'markers',...xyz(model.context),meta:{sampleView:sampleViewKey(),enrollmentContext:true},ids:model.context.map(r=>String(r.index)),text:model.context.map(explorationHover),marker:{size:s.contextSize,color:'#a8adb2',opacity:s.contextOpacity},hovertemplate:'%{text}<extra>Context</extra>',showlegend:false});
 traces.push(...explorationLineTraces(model,positions,s,metadata,explorationPathBank()));
 traces.push(...explorationVisitTraces(rows,positions,s,metadata));
 traces.push(...references.traces);
 renderSampleLegend(current().edges);updateSampleContext([...rows,...model.context].map(r=>r.index));
 const title=explorationVisits[s.visit]+' highlighted'+(s.subjects?.length?' · Heatmap group':s.nearby?' · Enrollment neighbors of '+s.anchor:'');el('sampleTitle').textContent=title;el('sampleTitle').title='Highlighted visits within the fixed full-population embedding; no refitting. Neighborhood metric is independent of display embedding.';
 const displayedSubjects=new Set(rows.map(participantKey));
 const displayedGroups=model.chosen.filter(g=>displayedSubjects.has(g.key));
 const armCounts=Object.keys(explorationArms).map(arm=>{const g=displayedGroups.filter(g=>metadata?.records[g.rows[0].id]?.arm===arm);return `${arm}: ${g.length} participants, ${g.filter(x=>x.enrollment&&x.followup&&!x.ambiguous).length} complete pairs`}).join(' · ');
 const missingFollowup=model.chosen.filter(g=>g.enrollment&&!g.followup).length;
 const note=(model.error||`${displayedGroups.length} participants · ${rows.length} highlighted samples; ${model.context.length} other samples shown in gray.`)+(s.nearby?` ${model.chosen.length} participants in the enrollment neighborhood (${s.k} nearest others plus anchor; cutoff ties included). Distance: ${explorationMetrics[s.metric]}.`:s.subjects?.length?` Heatmap group: ${s.subjects.length} selected participants; ${missingFollowup} without a retained follow-up in this view.`:'');
 el('enrollmentExploreStatus').textContent=note;el('sampleStatus').textContent=note;
 const byStage=Object.entries(explorationVisits).filter(([key])=>['enrollment','followup','delivery'].includes(key)).map(([key,label])=>`${rows.filter(r=>explorationStage(r)===key).length} ${label.replace(' only','').toLowerCase()}`);
 el('sampleContext').innerHTML=`<strong>Highlighted visits</strong><ul><li>${rows.length} highlighted samples · ${displayedGroups.length} participants</li><li>${model.context.length} other samples in gray · ${rows.length+model.context.length} samples in total</li><li>${esc(byStage.join(' · '))}</li></ul><p>${esc(armCounts)}</p>${s.nearby&&rows.some(r=>explorationIsAnchor(r.subject,s))?`<p><strong>Anchor: ${esc(s.anchor)}</strong> · larger outlined markers; its connecting path is twice as thick when shown.</p>`:''}<p>Highlighted enrollment: circles; follow-up: diamonds; delivery: squares. Other samples remain visible in gray. ${s.lines?`Connecting path: ${explorationPathTypes[s.path||'straight']}. Arrows, when enabled, point toward follow-up.`:'Connecting paths hidden.'}</p><details><summary>Neighborhood and timing notes</summary><p>Neighbors use full enrollment compositions, independently of the display embedding. Changing visits retains the participant set. The graph keeps its full population; choosing a graph state exits this view. Connections do not represent observed intermediate states. Fermat routes minimize the sum of powered distances in full abundance space using the selected sample-embedding normalization and metric. Their fixed support pools enrollment and follow-up samples from both arms, excluding delivery, independently of the highlighted group. Intermediate points may belong to other participants and arms; they have no time ordering and are not evidence of treatment effects. The 3D display can distort these distances.</p><p>${esc(metadata?.timingNote||'Treatment annotation unavailable.')}</p></details>`;
 el('inspector').hidden=true;
 el('endpointChoices').hidden=true;
 return renderSamplePlot(traces,{margin:{l:0,r:0,t:0,b:0},showlegend:false,uirevision:META.id+'-enrollment-exploration-'+maxNormalizedMethod(),scene:{...(pendingSampleCamera?{camera:copyCamera(pendingSampleCamera)}:{}),aspectmode:'data',dragmode:'orbit',...axes,annotations:references.annotations}},{responsive:true,scrollZoom:true,displaylogo:false,displayModeBar:false});
}
function explorationLegend(){
 if(!explorationActive())return false;
 const model=explorationRendered,records=model?.rows||[],metadata=explorationMetadata(),s=baselineExplore;
 const rows=s.treatment&&metadata?Object.entries(explorationArms).map(([arm,color])=>({label:arm+' (highlighted)',color,n:records.filter(r=>metadata.records[r.id].arm===arm).length})):[{label:explorationVisits[s.visit]+' (highlighted)',color:s.color||explorationDefaults().color,n:records.length}];
 rows.push({label:'Other samples (context)',color:'#a8adb2',n:model?.context.length||0});
 const population=legendPopulation(datasetRegistry.get(META.id),true);
 el('sampleLegend').hidden=false;el('sampleLegendItems').innerHTML=legendTable(rows,population,{title:s.treatment&&metadata?'Randomized assignment':'Visit highlights',viewN:records.length+(model?.context.length||0),note:'Each sample is counted once, including gray context. Size and opacity do not change these counts, even at 0% opacity. Highlighted enrollment: circles; follow-up: diamonds; delivery: squares. Treatment colors indicate assignment, not dose exposure.'});return true;
}
function updateExploration(patch){
 if(patch.nearby===true)patch={...patch,subjects:null};
 rememberSelection();baselineExplore={...baselineExplore,...patch,dataset:META.id};participantRestore(null);rank3Clear();rank3.enabled=false;syncRank3Controls();pureCoverageComparison=null;selected=null;selectedVertex=null;hiddenEdges=new Set();
 syncExplorationControls();graph();inspect();table();return refreshSamples(readCamera('samples'));
}
function installExploration(){
 const box=el('enrollmentExploreControls');box.hidden=true;
 box.innerHTML=`<label>Highlight visits<select id="explorationVisit"><option value="off">Standard view</option>${Object.entries(explorationVisits).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>Highlight color<input id="enrollmentHighlightColor" type="color" value="#0072b2" title="Color of highlighted visits. Turn off treatment coloring to use this color."></label><details open><summary>Visit appearance</summary>${explorationAppearanceControls.map(([key,label,min,max,scale,value])=>`${key==='lineWidth'?'<label><input type="checkbox" id="enrollmentLines" checked> Connect enrollment to follow-up</label><label>Connecting path<select id="enrollmentPath" title="Fermat paths use full abundance profiles with the selected embedding normalization and metric. Intermediate points pool enrollment and follow-up from both arms, excluding delivery. These are geometric routes, not observed biological trajectories."><option value="straight">Straight line</option><option value="fermat11">Fermat p = 1.1</option><option value="fermat125">Fermat p = 1.25</option></select></label><label><input type="checkbox" id="enrollmentArrows" title="Show direction from enrollment toward follow-up on connecting lines or paths. No arrow is drawn when the endpoints coincide."> Show direction arrows</label>':''}<label for="enrollment${key}">${label} · <output id="enrollment${key}Value">${Math.round(value*scale)}${scale===100?'%':' px'}</output><input id="enrollment${key}" type="range" min="${min}" max="${max}" step="1" value="${value*scale}"></label>`).join('')}<small>0% opacity hides points or lines without changing the selected visits or counts.</small></details><label><input type="checkbox" id="enrollmentPairedOnly"> Highlight complete enrollment–follow-up pairs only</label><label><input type="checkbox" id="enrollmentNearby"> Nearby enrollment participants</label><label for="enrollmentAnchor">Enrollment anchor</label><div class="participantPicker enrollmentAnchorPicker"><button id="previousEnrollmentAnchor" type="button" aria-label="Previous enrollment anchor" title="Previous eligible enrollment participant" disabled>‹</button><select id="enrollmentAnchor"></select><button id="nextEnrollmentAnchor" type="button" aria-label="Next enrollment anchor" title="Next eligible enrollment participant" disabled>›</button></div><label>Nearest other participants<input id="enrollmentNeighbors" type="number" min="1" max="500" step="1" value="20"></label><div class="distanceControl"><button id="enrollmentDistanceHelp" class="distanceHelpLabel" type="button" aria-haspopup="dialog" aria-controls="neighborhoodDistanceDialog" title="Ordinary distances compare complete abundance profiles directly. Fermat distances use paths through enrollment samples and favor many short steps through densely sampled regions. Click for formulas, examples and limitations. Fermat is currently available in the heatmap, not this dropdown.">Neighborhood distance</button><select id="enrollmentDistance" aria-labelledby="enrollmentDistanceHelp">${Object.entries(explorationMetrics).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div><label><input type="checkbox" id="enrollmentTreatment"> Color highlights by treatment assignment</label><button id="exportEnrollmentNeighborhood" type="button">Export highlighted visits CSV</button><button id="clearHeatmapGroup" type="button" hidden>Clear heatmap group</button><button id="openEnrollmentHeatmap" type="button">Enrollment distance heatmap…</button><small id="enrollmentExploreStatus" role="status"></small>`;

 for(const [key] of explorationAppearanceControls)el('enrollment'+key).oninput=()=>updateExplorationAppearance(key,Number(el('enrollment'+key).value));
 el('enrollmentPath').onchange=()=>updateExplorationPath(el('enrollmentPath').value);
 el('enrollmentArrows').onchange=()=>updateExplorationArrows(el('enrollmentArrows').checked);
 el('enrollmentDistanceHelp').onclick=()=>el('neighborhoodDistanceDialog').showModal();
 el('heatmapDistanceHelp').onclick=()=>el('neighborhoodDistanceDialog').showModal();
 el('closeNeighborhoodDistance').onclick=()=>el('neighborhoodDistanceDialog').close();
 el('clearHeatmapGroup').onclick=()=>updateExploration({subjects:null});
 el('enrollmentHighlightColor').onchange=()=>updateExploration({color:el('enrollmentHighlightColor').value});
 el('explorationVisit').onchange=()=>{
  const visit=el('explorationVisit').value;
  if(explorationVisits[visit]&&stateTransitionsAvailable())stateTransitionMode=true;
  return updateExploration({visit});
 };
 for(const [id,key] of [['enrollmentNearby','nearby'],['enrollmentPairedOnly','pairedOnly'],['enrollmentLines','lines'],['enrollmentTreatment','treatment']])el(id).onchange=()=>updateExploration({[key]:el(id).checked,...(baselineExplore.visit==='off'?{visit:'enrollment'}:{})});
 el('previousEnrollmentAnchor').onclick=()=>stepEnrollmentAnchor(-1);el('nextEnrollmentAnchor').onclick=()=>stepEnrollmentAnchor(1);
 el('enrollmentAnchor').onchange=()=>updateExploration({anchor:el('enrollmentAnchor').value});
 el('enrollmentNeighbors').onchange=()=>updateExploration({k:Math.max(1,Math.min(500,Math.round(Number(el('enrollmentNeighbors').value)||20)))});
 el('enrollmentDistance').onchange=()=>updateExploration({metric:el('enrollmentDistance').value});
 el('exportEnrollmentNeighborhood').onclick=()=>{
  if(!explorationActive()||!explorationRendered)return;
  const metadata=explorationMetadata(),distances=new Map(explorationRendered.chosen.map(g=>[g.key,g.distance??'']));
  const rows=[['sample','participant','visit','assignment','collection_date','earlier_day_doses','days_since_earlier_day_dose','enrollment_distance','neighborhood_metric'],...explorationRendered.rows.map(r=>{const m=metadata?.records[r.id];return [r.id,r.subject,r.originalVisit,m?.arm||'',m?.date||'',m?.priorDoses??'',m?.daysSinceDose??'',distances.get(participantKey(r)),baselineExplore.nearby?baselineExplore.metric:'']})];
  const csv=rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download=META.id+'-highlighted-visits.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
}
