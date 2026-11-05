// Skin v2 preserves verified identities, unknown metadata and vetted edges.
function skinPopulationSelection(data, selection) {
 const states=data.genusStates,level=states?.levels[String(selection.coverage||90)];
 const retained=states&&selection.assignRemaining===false?new Set(states.sampleIds.filter((_,i)=>level.cores.includes(states.pure[i]))):null;
 const subjects=data.records.filter(r=>(!selection.site||JSON.stringify(r.site)===selection.site)&&
  (!selection.visit||JSON.stringify(r.visitOrder)===selection.visit)&&
  (!selection.participant||r.participantId===selection.participant)&&(!retained||retained.has(r.specimenId)));
 const members=new Set(subjects.map(r=>r.specimenId));
 const edges=selection.paths&&selection.participant?data.pairs.filter(e=>members.has(e.from)&&members.has(e.to)):[];
 return {subjects,edges};
}
function skinStateColor(key){let hash=2166136261;for(const c of key)hash=Math.imul(hash^c.charCodeAt(0),16777619);return `hsl(${(hash>>>0)%360},65%,42%)`}
if(typeof module!=='undefined')module.exports={skinPopulationSelection,skinStateColor};
async function showSkinPopulationV2(data, choices) {
 const el=id=>document.getElementById(id), plot=el('samples'), panel=el('samplePanel');
 const text=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const label=v=>v===null?'Unknown / unverified':String(v).replaceAll('_',' ');
 const records=data.records, byId=new Map(records.map(r=>[r.specimenId,r]));
 const eligible=new Map(data.eligibility.map(e=>[e.specimenId,e]));
 const method=el('sampleMethod'), participant=el('participantSelect');
 const states=data.genusStates,stateIndex=new Map((states?.sampleIds||[]).map((id,i)=>[id,i]));
 if(states&&(states.datasetId!==data.id||states.baseRevision!==data.revision||JSON.stringify(states.sampleIds)!==JSON.stringify(records.map(r=>r.specimenId))))throw Error('Skin state annotations do not match this population.');
 const button=(id,title)=>{const b=document.createElement('button');b.id=id;b.textContent=title;b.className='maximizePanel';return b};
 const select=(id,title,items)=>{const s=document.createElement('select');s.id=id;s.add(new Option(title,''));for(const [v,t] of items)s.add(new Option(t,v));return s};
 const field=(title,input)=>{const l=document.createElement('label');l.append(title+' ',input);return l};
 const coverage=document.createElement('select');coverage.id='skinCoverage';
 for(const q of [60,70,80,90,100])coverage.add(new Option(q+'%',String(q)));coverage.value='90';coverage.disabled=!states;
 const assign=document.createElement('input');assign.type='checkbox';assign.id='skinAssignRemaining';assign.checked=true;assign.disabled=!states;
 const colorBy=document.createElement('select');colorBy.id='skinColorBy';
 for(const [id,title] of [['merged','90% genus 2-CSTs'],['pure','Pure genus 2-CSTs'],['cohort','Cohorts'],['visit','Verified visit order']]){const o=new Option(title,id);o.disabled=!states&&['merged','pure'].includes(id);colorBy.add(o)}
 colorBy.value=states?'merged':'visit';
 const settingsKey='cosmix-skin-view-v1:'+data.id+'@'+data.revision;
 let saved={};try{saved=JSON.parse(localStorage.getItem(settingsKey)||'{}')}catch{}
 if(states&&[60,70,80,90,100].includes(Number(saved?.coverage)))coverage.value=String(saved.coverage);
 if(states&&typeof saved?.assignRemaining==='boolean')assign.checked=saved.assignRemaining;
 if([...colorBy.options].some(o=>o.value===saved?.colorBy&&!o.disabled))colorBy.value=saved.colorBy;
 const coverageField=field('Largest 2-CSTs coverage',coverage);
 coverageField.title=states?'Select the largest original genus-pair groups covering this fraction of this cohort. Equal-sized groups at the boundary stay together; actual coverage may be higher.':'Genus-state supplement is not installed.';
 const assignField=field('Assign remaining samples to retained states',assign);
 assignField.title=states?'On: include remaining specimens using saved within-cohort assignments. Off: show only original members of the retained pure cores. The ASV-based coordinates stay unchanged.':'Genus-state supplement is not installed.';
 const colorField=field('Color by',colorBy);colorField.title='Genus groups annotate existing ASV-based maps. Color changes preserve samples and coordinates. Merged labels name retained cores; assigned specimens need not have that original pair.';
 const site=select('skinSite','All sites',[...new Set(records.map(r=>r.site))].sort((a,b)=>label(a).localeCompare(label(b))).map(v=>[JSON.stringify(v),label(v)]));
 const orders=[...new Set(records.map(r=>r.visitOrder))].sort((a,b)=>a===null?1:b===null?-1:a-b);
 const visit=select('skinVisit','All visits',orders.map(v=>[JSON.stringify(v),v===null?label(null):[...new Set(records.filter(r=>r.visitOrder===v).map(r=>r.visitLabel))].join(' / ')+' (order '+v+')']));
 const specimen=select('skinSpecimen','All specimens',[]);
 const paths=document.createElement('input');paths.type='checkbox';paths.id='skinTrajectories';paths.checked=true;
 const exportSamples=button('skinExportSamples','Export displayed specimens');
 const exportEdges=button('skinExportEdges','Export displayed trajectories');
 const save=button('skinSavePNG','Save PNG…'), maximize=button('skinMaximize','⛶ Maximize');
 const clear=button('skinClear','Clear selection'), previous=button('skinPrevious','‹'), next=button('skinNext','›');
 previous.title='Previous participant';next.title='Next participant';
 participant.replaceChildren(new Option('All participants',''));
 for(const id of [...new Set(records.filter(r=>eligible.get(r.specimenId).participantLinkEligible).map(r=>r.participantId))].sort())participant.add(new Option(id,id));
 const navigation=document.createElement('div');navigation.style.cssText='display:flex;gap:4px;width:100%';navigation.append(previous,participant,next);
 for(const b of [previous,next])b.style.cssText='width:28px;min-width:28px;flex:0 0 28px;padding:4px';
 participant.style.cssText='min-width:0;width:0;flex:1';
 previous.setAttribute('aria-label','Previous participant');next.setAttribute('aria-label','Next participant');
 el('participantSection').querySelector('.sectionControls').replaceChildren(field('Participant',navigation),field('Body site',site),field('Visit',visit),field('Specimen',specimen),field('Connect selected participant’s same-site visits',paths),exportSamples,exportEdges);
 el('controlSections').replaceChildren(el('dataControls'),el('participantSection'));
 const cohort=el('cohortSelect'),cohorts=globalThis.VME_ASSETS?.skinCohorts||[{id:data.id,title:data.title}];
 cohort.replaceChildren(...cohorts.map(c=>new Option(c.title,c.id)));cohort.value=data.id;cohort.disabled=false;
 el('cohortControl').hidden=false;el('cohortControl').title='Independent study/body-site populations. Each cohort has its own samples, assignments and three embedding maps; there is no pooled All-cohorts map.';
 el('dataControls').querySelector('.sectionControls').append(coverageField);
 el('datasetMessage').textContent=data.exploratory.badge+'. Population maps only; no local fits or state graph.';
 el('panelWorkspace').replaceChildren(panel);el('panelWorkspace').style.display='block';panel.style.height='100%';
 const detail=el('sampleContext');el('sampleSidePanels').replaceChildren(detail);detail.style.padding='0 10px';
 el('sampleInfoDivider').setAttribute('role','presentation');el('sampleInfoDivider').removeAttribute('tabindex');el('sampleInfoDivider').style.pointerEvents='none';
 panel.querySelector('.sampleHeaderActions').replaceChildren(clear,method.closest('label'),colorField,assignField,save,maximize);
 el('sampleTitle').textContent=data.title;document.title='CoSMiX — '+data.title;
 el('sampleStress').hidden=false;el('sampleStress').disabled=false;
 method.replaceChildren(new Option('L1-normalized · Euclidean','l1-euclidean'),new Option('Max-normalized · Euclidean','max-euclidean'),new Option('Max-normalized · L∞','max-linf'));
 for(const input of [el('datasetSelect'),method,participant,el('toggleControls')])input.disabled=false;
 el('datasetSelect').value='skin';el('datasetSelect').onchange=()=>{const u=new URL(location.href);u.searchParams.set('dataset',el('datasetSelect').value);u.searchParams.delete('cohort');location.assign(u.href)};
 cohort.onchange=()=>{const u=new URL(location.href);u.searchParams.set('dataset','skin');u.searchParams.set('cohort',cohort.value);location.assign(u.href)};
 const url=new URL(location.href);url.searchParams.set('dataset','skin');url.searchParams.set('cohort',data.id);history.replaceState(null,'',url);
 el('toggleControls').onclick=()=>{const closed=el('explorerLayout').classList.toggle('controlsCollapsed');el('controlSections').hidden=closed;el('toggleControls').textContent=closed?'›':'‹';requestAnimationFrame(()=>Plotly.Plots.resize(plot))};
 maximize.onclick=()=>{const open=panel.dataset.skinMaximized!=='true';panel.dataset.skinMaximized=String(open);panel.style.position=open?'fixed':'';panel.style.inset=open?'8px':'';panel.style.zIndex=open?'1000':'';panel.style.height=open?'calc(100vh - 16px)':'100%';maximize.textContent=open?'Restore':'⛶ Maximize';maximize.setAttribute('aria-expanded',String(open));requestAnimationFrame(()=>Plotly.Plots.resize(plot))};
 let subjects=[], edges=[], drawVersion=0, downloadLinks=[];
 const colors=['#0072b2','#d55e00','#009e73','#cc79a7','#e69f00','#56b4e9','#882255','#444444'];
 const stateKey=(r,mode=colorBy.value)=>mode==='pure'?states.pure[stateIndex.get(r.specimenId)]:states.levels[coverage.value].assignments[stateIndex.get(r.specimenId)];
 const color=r=>colorBy.value==='cohort'?skinStateColor(data.id):colorBy.value==='visit'?(r.visitOrder===null?'#888888':colors[orders.indexOf(r.visitOrder)%colors.length]):skinStateColor(JSON.stringify([...states.states[stateKey(r)].components].sort()));
 const annotation=r=>!states?null:{pureState:states.pure[stateIndex.get(r.specimenId)],pureLabel:states.states[stateKey(r,'pure')].label,
  assignedState:stateKey(r,'merged'),assignedLabel:states.states[stateKey(r,'merged')].label,
  pureComponents:states.states[stateKey(r,'pure')].components,assignedComponents:states.states[stateKey(r,'merged')].components,
  method:states.levels[coverage.value].methods[stateIndex.get(r.specimenId)]};
 const envelope=()=>({datasetId:data.id,revision:data.revision,embedding:method.value,exploratory:data.exploratory,colorBy:colorBy.value,
  stateRevision:states?.revision||null,coverage:states?Number(coverage.value):null,assignRemaining:states?assign.checked:null,
  stateMeaning:states?'Genus groups over ASV-based population coordinates; assignments computed within this cohort in genus-pooled L1 Euclidean space.':null});
 function download(raw,name,type){
  const href=URL.createObjectURL(new Blob([raw],{type})),a=document.createElement('a');a.href=href;a.download=data.id+'-'+name;a.textContent='Download '+name;a.style.display='block';detail.append(a);downloadLinks.push(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(href);a.remove()},300000);
 }
 async function draw(){
  const version=++drawVersion, bank=data.banks[method.value],co=bank.coordinates;
  colorBy.options[0].textContent=coverage.value+'% genus 2-CSTs';
  try{localStorage.setItem(settingsKey,JSON.stringify({coverage:coverage.value,assignRemaining:assign.checked,colorBy:colorBy.value}))}catch{}
  ({subjects,edges}=skinPopulationSelection(data,{site:site.value,visit:visit.value,participant:participant.value,paths:paths.checked,coverage:coverage.value,assignRemaining:assign.checked}));
  const old=specimen.value;specimen.replaceChildren(new Option('All specimens',''));for(const r of subjects)specimen.add(new Option(r.specimenId,r.specimenId));if(subjects.some(r=>r.specimenId===old))specimen.value=old;
  previous.disabled=participant.selectedIndex<=1;next.disabled=participant.selectedIndex>=participant.options.length-1;
  const traces=[];
  function trace(ids,props){if(ids.length)traces.push({type:'scatter3d',ids,x:ids.map(i=>co[i][0]),y:ids.map(i=>co[i][1]),z:ids.map(i=>co[i][2]),showlegend:false,...props})}
  for(const e of edges)trace([e.from,e.to],{mode:'lines',line:{color:'#456577',width:5},hoverinfo:'skip',name:label(byId.get(e.from).site)});
  function markers(rows,background){trace(rows.map(r=>r.specimenId),{mode:'markers',text:rows.map(r=>text([r.specimenId,r.participantId===null?'Participant unknown / unverified':r.participantId,label(r.site),r.visitLabel,...Object.entries(r.validity).filter(([,v])=>v!=='verified').map(([k,v])=>k+': '+v),...(states?['Pure genus 2-CST: '+states.states[stateKey(r,'pure')].label,coverage.value+'% assigned genus 2-CST: '+states.states[stateKey(r,'merged')].label+' ('+annotation(r).method+')']:[])].join(' · '))),hoverinfo:'text',marker:{size:rows.map(r=>r.specimenId===specimen.value?11:background?3:6),opacity:background?.25:.9,color:background?'#b5bcc1':rows.map(color)}})}
  markers(subjects,false);
  detail.replaceChildren();downloadLinks=[];
  const line=(tag,value)=>{const n=document.createElement(tag);n.textContent=value;detail.append(n);return n};
  line('h3',data.exploratory.badge);line('p',data.exploratory.notice).id='skinExploratoryNotice';
  line('h3',participant.value?'Participant '+participant.value:'Displayed population');
  const known=new Set(subjects.filter(r=>eligible.get(r.specimenId).participantLinkEligible).map(r=>r.participantId));
  line('p',subjects.length+' specimens · '+known.size+' verified participants · '+subjects.filter(r=>r.participantId===null).length+' specimens without verified participant linkage');
  line('p',edges.length+' displayed same-site trajectories. Filters retain only existing edges; they do not bridge hidden visits.');
  line('p','Population coordinates and the ASV-based distance targets are retained for every selection.');
  if(states){
   const level=states.levels[coverage.value];
   line('p','Genus groups over ASV-based coordinates. Largest 2-CSTs coverage: '+coverage.value+'% (actual '+level.achievedCoverage.toFixed(2)+'%; '+level.coreCount+'/'+records.length+' original-core specimens).');
   const routes={core:0,rank3:0,knn:0};for(const r of subjects)routes[annotation(r).method]++;
   line('p',assign.checked?'Remaining specimens assigned within this cohort; a merged label need not be the original leading pair.':'Only original members of retained pure cores are displayed.');
   line('p','Displayed assignment routes: '+routes.core+' original core · '+routes.rank3+' rank-3 support · '+routes.knn+' neighbor vote.');
  }
  if(!subjects.length)line('p','No specimens match these filters and retained cores.');
  line('h3',colorBy.options[colorBy.selectedIndex].textContent);
  if(colorBy.value==='visit')line('p','Visit colors identify verified order, not elapsed time; colors repeat after eight orders. Unknown/unverified visits are gray.');
  const groups=new Map();
  for(const r of subjects){const key=['merged','pure'].includes(colorBy.value)?stateKey(r):colorBy.value==='cohort'?data.id:JSON.stringify(r.visitOrder);if(!groups.has(key))groups.set(key,{n:0,color:color(r),label:['merged','pure'].includes(colorBy.value)?states.states[key].label:colorBy.value==='cohort'?data.title:r.visitOrder===null?'Unknown / unverified visit':'Visit order '+r.visitOrder});groups.get(key).n++}
  line('p','n: displayed specimens. % and c%: fraction of all '+records.length+' eligible specimens in this cohort. c% accumulates down the table.');
  const table=document.createElement('table');table.id='skinColorLegend';table.style.cssText='width:100%;border-collapse:collapse;font-size:12px';const header=table.insertRow();for(const title of ['Category','n','%','c%']){const th=document.createElement('th');th.textContent=title;th.style.textAlign='left';header.append(th)}
  let cumulative=0;for(const g of [...groups.values()].sort((a,b)=>b.n-a.n||a.label.localeCompare(b.label))){cumulative+=g.n;const row=table.insertRow();for(const value of [g.label,g.n,(100*g.n/records.length).toFixed(2),(100*cumulative/records.length).toFixed(2)]){const cell=row.insertCell();cell.textContent=value;cell.style.cssText='padding:4px;border-bottom:1px solid #d4e0e5'}row.cells[0].style.borderLeft='7px solid '+g.color}detail.append(table);
  if(participant.value||specimen.value){for(const r of subjects.filter(r=>!specimen.value||r.specimenId===specimen.value))line('p',r.specimenId+' · '+label(r.site)+' · '+r.visitLabel);for(const e of edges)line('p',e.from+' → '+e.to+' · '+e.timingReason+(e.excludedVisitIds.length?' · '+e.gapReason:''))}
  const ev=bank.diagnostics.evaluation;
  el('sampleStress').textContent=ev.value===null?'RMS relative error unavailable':'RMS relative error: '+ev.value.toFixed(2)+'% (all pairs)';
  el('sampleStress').title='100 × square root of the mean of ((3D distance − target distance) / target distance)². Lower means closer distance agreement; this does not measure biological validity.';
  el('sampleStress').onclick=()=>alert(el('sampleStress').title+' The target uses the selected normalization and distance. All positive-distance pairs are included, including fitting pairs.');
  // Keep one population frame while filtering; subset aspect changes can clip paths.
  const axes={};
  for(const [i,name] of ['xaxis','yaxis','zaxis'].entries()){
   const values=records.map(r=>co[r.specimenId][i]),lo=Math.min(...values),hi=Math.max(...values),pad=Math.max((hi-lo)*.12,1e-6);
   axes[name]={visible:false,autorange:false,range:[lo-pad,hi+pad]};
  }
  await Plotly.react(plot,traces,{margin:{l:0,r:0,t:5,b:0},uirevision:data.id+'|'+method.value,scene:{aspectmode:'data',...axes}},{responsive:true,displaylogo:false,modeBarButtonsToRemove:['toImage']});
  if(version!==drawVersion)return;
 }
 for(const input of [method,participant,site,visit,specimen,paths,coverage,assign,colorBy])input.onchange=draw;
 previous.onclick=()=>{if(participant.selectedIndex>1){participant.selectedIndex--;draw()}};
 next.onclick=()=>{if(participant.selectedIndex<participant.options.length-1){participant.selectedIndex++;draw()}};
 clear.onclick=()=>{participant.value=site.value=visit.value=specimen.value='';draw()};
 exportSamples.onclick=()=>download(JSON.stringify(subjects.map(r=>({...envelope(),record:r,eligibility:eligible.get(r.specimenId),state:annotation(r)})),null,2),'displayed-specimens.json','application/json');
 exportEdges.onclick=()=>download(JSON.stringify(edges.map(e=>({...envelope(),edge:e,site:byId.get(e.from).site,fromOrder:byId.get(e.from).visitOrder,toOrder:byId.get(e.to).visitOrder})),null,2),'displayed-trajectories.json','application/json');
 save.onclick=async()=>{
  save.disabled=true;const box=document.createElement('div');box.style.cssText='position:fixed;left:-10000px;width:1400px;height:1100px';document.body.append(box);
  try{
   const wrap=s=>{let lines=[],line='';for(const word of s.split(/\s+/)){if(line.length+word.length>145){lines.push(line);line=''}line+=(line?' ':'')+word}return [...lines,line].map(text).join('<br>')};
   const layout={...plot.layout,width:1400,height:1100,title:{text:text(data.title+' · '+method.options[method.selectedIndex].textContent),font:{size:15}},margin:{l:20,r:20,t:60,b:300},scene:{...plot.layout.scene,camera:plot._fullLayout.scene.camera},annotations:[{xref:'paper',yref:'paper',x:0,y:-.07,xanchor:'left',yanchor:'top',align:'left',showarrow:false,font:{size:11},text:wrap(data.exploratory.badge+'. '+data.exploratory.notice+' Selected: '+subjects.length+' specimens; '+edges.length+' trajectories. Color by: '+colorBy.options[colorBy.selectedIndex].textContent+'. '+(states?'Genus groups over ASV-based coordinates; coverage '+coverage.value+'% (actual '+states.levels[coverage.value].achievedCoverage.toFixed(2)+'%); '+(assign.checked?'remaining specimens assigned':'original retained-core specimens only')+'. ':'')+'Dataset revision: '+data.revision)}]};
   await Plotly.newPlot(box,plot.data,layout,{staticPlot:true,displayModeBar:false});
   const uri=await Plotly.toImage(box,{format:'png',width:1400,height:1100,scale:1});
   const raw=await(await fetch(uri)).blob();download(raw,'samples.png','image/png');
  }catch(error){const p=document.createElement('p');p.textContent='PNG export failed: '+error.message;detail.append(p)}finally{Plotly.purge(box);box.remove();save.disabled=false}
 };
 await draw();
}
