// AGP colors and filters are assignments in abundance space. Coordinates come from the saved population fit.
async function showAgpPopulation(data, choices, references, graphLayouts){
 const el=id=>document.getElementById(id), method=el('sampleMethod'),color=el('sampleColorScheme'),
       assign=el('stateMode'),plot=el('samples'),info=el('sampleContext'),selector=el('datasetSelect');
 const title=choices.find(item=>item.id===data.id).title;
 document.title='CoSMiX — '+title;el('sampleTitle').textContent=title;
 const header=el('samplePanel').querySelector('.sampleHeaderActions');
 const labels=el('participantShowVertices'),labelControl=labels.closest('label');
 labelControl.lastChild.textContent=' Component labels';
 labelControl.title=references?'Label each component at its highest observed relative abundance in the full AGP population.':'Install component-references.json beside the AGP population to enable observed reference positions.';
 labels.checked=false;labels.disabled=!references;
 const navigation=header.querySelector('.sampleHeaderNavigation'),save=el('saveSampleView');
 header.replaceChildren(navigation,color.closest('label'),assign.closest('label'),labelControl,method.closest('label'),save);
 el('controlSections').replaceChildren(el('dataControls'));
 el('cohortControl').hidden=true;
 el('datasetMessage').textContent=data.ids.length.toLocaleString()+' fecal samples · 340 SILVA taxa';
 const workspace=el('panelWorkspace');
 workspace.replaceChildren(el('samplePanel'),el('featurePanel'));
 const sheet=document.createElement('style');
 sheet.textContent=`
 #panelWorkspace.agpWorkspace{grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr);gap:8px}
 #panelWorkspace.agpWorkspace>#samplePanel{grid-area:1/1}#panelWorkspace.agpWorkspace>#featurePanel{grid-area:1/2}
 .agpWorkspace #graphContent{grid-template-columns:minmax(0,1fr) minmax(145px,32%);gap:5px}
 .agpWorkspace #graphPlotArea{display:block;overflow:auto}
 .agpWorkspace #graphDetails{grid-column:2}
 .agpWorkspace #sampleContent{grid-template-columns:minmax(0,1fr) minmax(145px,30%);grid-template-rows:minmax(0,1fr)}
 .agpWorkspace #sampleSidePanels{grid-column:2;grid-row:1}
 .agpWorkspace .sampleHeaderActions label{display:inline-flex;gap:4px;align-items:center;font-size:12px}
 .agpWorkspace .agpExpanded{position:fixed!important;inset:0;z-index:1000;background:white}
 @container (max-width:690px){
   .agpWorkspace #sampleContent{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(90px,28%)}
   .agpWorkspace #sampleSidePanels{grid-column:1;grid-row:2}
 }
 @media(max-width:1050px){#panelWorkspace.agpWorkspace{display:flex;flex-direction:column;overflow:auto}.agpWorkspace>.card{flex:0 0 70vh}}
 `;
 document.head.append(sheet);workspace.classList.add('agpWorkspace');
 const appearance=el('sampleAppearanceVertices'),side=el('sampleDetails');
 const spheres=el('sampleReferenceSpheres'),scale=el('sampleReferenceScale'),tint=el('sampleReferenceColor'),
       ambient=el('sampleReferenceSphereAmbient'),highlights=el('sampleReferenceSphereHighlights'),fontSize=el('participantVertexLabelSize');
 const group=el('sampleAppearance');
 group.replaceChildren(group.querySelector('summary'),appearance);side.replaceChildren(group);
 el('sampleSidePanels').replaceChildren(side,info);info.style.padding='8px';
 el('sampleInfoDivider').remove();
 el('sampleContent').removeAttribute('data-legend-position');

 const url=new URL(location.href);url.searchParams.set('dataset',data.id);history.replaceState(null,'',url);
 selector.value=data.id;selector.onchange=()=>{url.searchParams.set('dataset',selector.value);location.assign(url.href)};
 const stress=el('sampleStress');
 stress.removeAttribute('aria-haspopup');
 stress.onclick=()=>{details.open=!details.open};
 const details=document.createElement('details');
 const summary=document.createElement('summary');summary.textContent='How the embedding was evaluated';
 const formula=document.createElement('p');formula.textContent='The reported error is 100 × √mean[((3D distance − original distance) / original distance)²] over 353,251 held-out pairs. All three maps use Euclidean distance on screen. The original distance follows the selected method. Each fit used 4,000 pivots and 200 epochs.';
 details.append(summary,formula);
 for(const control of [selector,color,method,assign,stress,el('toggleControls')])control.disabled=false;
 el('toggleControls').onclick=()=>{
  const collapsed=el('explorerLayout').classList.toggle('controlsCollapsed');
  el('controlSections').hidden=collapsed;el('toggleControls').textContent=collapsed?'›':'‹';
  el('toggleControls').setAttribute('aria-expanded',String(!collapsed));
  requestAnimationFrame(()=>Plotly.Plots.resize(plot));
 };
 method.replaceChildren(new Option('L1-normalized · Euclidean','l1-euclidean'),new Option('Max-normalized · Euclidean','max-euclidean'),new Option('Max-normalized · L∞','max-linf'));
 color.replaceChildren(...Object.entries(data.schemes).map(([key,s])=>new Option(s.k+'-CSTs · '+s.q+'% coverage',key)));
 color.title='Retained states are ranked by the number of samples with those leading taxa.';
 assign.checked=true;
 const palette=['#0072b2','#d55e00','#009e73','#cc79a7','#7158a5','#ab7512','#138d9c','#914c57'];
 const stateColors=new Map();
 for(const scheme of Object.values(data.schemes))for(const state of scheme.cores){
  if(!stateColors.has(state)){const i=stateColors.size;stateColors.set(state,palette[i]||('hsl('+Math.round(i*137.508%360)+',55%,'+(35+10*(i%3))+'%)'))}
 }
 const rows=new Map(data.ids.map((id,i)=>[id,i]));
 const graph=agpGraphPanel(data,references,rows,graphLayouts);
 const openExport=installPngExportDialog(el,async()=>{
  await sampleReady;
  const clone=x=>JSON.parse(JSON.stringify(x)),layout=clone(plot.layout);
  layout.scene=pngExportScene(plot,clone(plot._fullLayout.scene._scene.getCamera()));
  const width=Math.max(1,plot.clientWidth),height=Math.max(1,plot.clientHeight);
  Object.assign(layout,{width,height,autosize:false});
  const s=data.schemes[color.value],selected=graph.selection();
  const rows=[{text:color.selectedOptions[0].textContent+' · '+(assign.checked?'Assigned and core samples':'Core samples only')},
   {text:plot.data[0].ids.length.toLocaleString()+' samples displayed'}];
  if(selected)rows.push({text:'Selected '+(selected.edge?'state: ':'vertex: ')+selected.name});
  for(const tr of Array.from(info.querySelector('table').rows).slice(1)){
   const cells=tr.cells;rows.push({text:cells[0].textContent+' · '+cells[3].textContent+' samples ('+cells[4].textContent+'%)',color:cells[0].firstElementChild.style.backgroundColor});
  }
  return {width,height,layout,data:clone(plot.data),rows,title:title+' · '+method.selectedOptions[0].textContent,
   filename:'cosmix-agp-samples-'+method.value+'-'+s.q+'pct-'+s.k+'cst-'+Date.now()};
 });
 el('viewExportClose').disabled=false;save.disabled=false;save.onclick=()=>openExport('samples');
 const ranges=new Map();
 const resize=()=>{Plotly.Plots.resize(plot);graph.resize()};
 for(const [panel,button] of [[el('featurePanel'),el('maximize-featurePanel')],[el('samplePanel'),document.createElement('button')]]){
  if(!button.isConnected){button.type='button';button.className='maximizePanel';button.textContent='⛶ Maximize';header.append(button)}
  button.disabled=false;button.onclick=()=>{
   const open=panel.classList.toggle('agpExpanded');
   button.textContent=open?'Restore':'⛶ Maximize';button.setAttribute('aria-expanded',String(open));
   requestAnimationFrame(resize);
  };
 }
 new ResizeObserver(resize).observe(workspace);
 let renderSamples,sampleReady;
 async function draw(){
  const s=data.schemes[color.value],bank=data.fits[method.value],coords=bank.coordinates;
  const xyz=[[],[],[]],colors=[],hover=[],ids=[],counts=new Map(s.cores.map(key=>[key,0]));
  const coreCounts=new Map(counts);
  graph.begin(s);
  let core=0;
  for(let i=0;i<data.ids.length;i++){
   const isCore=s.assignment[i]==='core',state=s.merged[i];
   if(isCore){core++;coreCounts.set(state,coreCounts.get(state)+1)}
   if(!assign.checked&&!isCore)continue;
   counts.set(state,counts.get(state)+1);
   ids.push(data.ids[i]);colors.push(graph.contains(state)?stateColors.get(state):'#dedede');
   for(let j=0;j<3;j++)xyz[j].push(coords[i][j]);
   hover.push([s.labels[state],isCore?'Original core member':s.assignment[i]==='rank-support'?'Assigned by rank '+(s.k+1)+' support':'Assigned by neighbor vote']);
  }
  info.replaceChildren();
  function add(tag,value){const node=document.createElement(tag);node.textContent=value;info.append(node);return node}
  add('h3',color.selectedOptions[0].textContent);
  add('p',core.toLocaleString()+' of '+data.ids.length.toLocaleString()+' samples are original core members ('+(100*core/data.ids.length).toFixed(2)+'%).');
  add('p',ids.length.toLocaleString()+' samples displayed · '+(ids.length-core).toLocaleString()+' assigned from other states');
  const table=document.createElement('table');table.style.width='100%';const head=table.createTHead().insertRow();
  for(const name of ['Retained state','Core','Assigned','n','%']){const th=document.createElement('th');th.textContent=name;head.append(th)}
  for(const state of s.cores){
   const n=counts.get(state),c=coreCounts.get(state),tr=table.insertRow(),label=tr.insertCell();
   const swatch=document.createElement('span');swatch.style.cssText='display:inline-block;width:10px;height:10px;margin-right:4px;background:'+stateColors.get(state);
   label.append(swatch,s.labels[state]);
   for(const v of [c,n-c,n,(100*n/data.ids.length).toFixed(2)])tr.insertCell().textContent=v.toLocaleString();
  }
  info.append(table);add('small','Percentages use all 24,421 samples. A merged label names its retained core.');info.append(details);
  stress.textContent='RMS relative error: '+bank.error.toFixed(2)+'% (held-out pairs)';
  if(!ranges.has(method.value))ranges.set(method.value,[0,1,2].map(j=>{
   const column=coords.map(v=>v[j]),lo=Math.min(...column),hi=Math.max(...column),pad=(hi-lo)*0.05;
   return [lo-pad,hi+pad];
  }));
  const [xaxis,yaxis,zaxis]=ranges.get(method.value).map(range=>({range,visible:false}));
  const samples={type:'scatter3d',mode:'markers',x:xyz[0],y:xyz[1],z:xyz[2],ids,
    marker:{size:2.5,color:colors,opacity:0.8},customdata:hover,text:ids,
    hovertemplate:'%{text}<br>%{customdata[0]}<br>%{customdata[1]}<extra></extra>'};
  const components=[...new Set(s.cores.flatMap(state=>state.split(',')))];
  const span=Math.max(...ranges.get(method.value).map(([lo,hi])=>(hi-lo)/1.1))||1;
  renderSamples=()=>{
   const visible=Boolean(labels.checked&&references),lit=visible&&spheres.checked;
   for(const input of [spheres,scale,tint,fontSize])input.disabled=!visible;
   for(const input of [ambient,highlights])input.disabled=!lit;
   for(const input of [scale,ambient,highlights,fontSize])el(input.id+'Value').value=input.value+(input===fontSize?' px':'%');
   const note=el('sampleReferenceNote');
   note.hidden=visible;note.textContent=references?'Turn on Component labels to show reference vertices.':labelControl.title;
   const traces=[samples],annotations=[];
   if(visible){
    const anchors=components.map(t=>references[t]),p=anchors.map(a=>coords[rows.get(a.sample)]);
    const size=5*Number(scale.value)/100;
    const hovertemplate='%{text}<br>Maximum relative abundance: %{customdata[1]}%<br>%{customdata[0]}<extra></extra>';
    const hoverData=anchors.map(a=>[a.sample,(100*a.count/a.total).toFixed(2)]);
    anchors.forEach((a,i)=>{
     annotations.push({x:p[i][0],y:p[i][1],z:p[i][2],text:a.label,
      ax:i%2===0?18:-18,ay:i%3===0?16:-16,xanchor:i%2===0?'left':'right',
      showarrow:true,arrowhead:0,arrowwidth:1,arrowcolor:'#78909c',bgcolor:'rgba(255,255,255,.85)',font:{size:Number(fontSize.value)}});
     if(lit){
      const mesh=vertexSphereMesh(p[i],size*span/600,{ambient:Number(ambient.value),highlights:Number(highlights.value)});
      traces.push({...mesh,meta:{componentReferences:true,component:components[i]},color:tint.value,
       text:a.label,customdata:mesh.x.map(()=>hoverData[i]),hovertemplate});
     }
    });
    if(!lit)traces.push({type:'scatter3d',mode:'markers',meta:{componentReferences:true},
     x:p.map(v=>v[0]),y:p.map(v=>v[1]),z:p.map(v=>v[2]),text:anchors.map(a=>a.label),
     marker:{size,symbol:'diamond',color:tint.value},customdata:hoverData,hovertemplate});
   }
   return sampleReady=Plotly.react(plot,traces,
    {showlegend:false,margin:{l:0,r:0,b:0,t:0},uirevision:method.value,scene:{aspectmode:'data',xaxis,yaxis,zaxis,annotations}},
    {responsive:true,displaylogo:false});
  };
  await Promise.all([renderSamples(),graph.update(s,counts,method.value)]);
 }
 for(const control of [method,color,assign])control.onchange=draw;
 for(const control of [labels,spheres])control.onchange=()=>renderSamples();
 for(const control of [scale,tint,ambient,highlights,fontSize])control.oninput=()=>renderSamples();
 graph.onSelect(draw);
 await draw();
}

// State counts come from the same retained-state memberships as the sample panel.
function agpGraphPanel(data,references,rows,bank){
 const el=id=>document.getElementById(id);
 const plot=el('graph3d'),area=el('graphPlotArea'),toolbar=el('graphDetails').querySelector('.graphToolbar');
 const layout=document.createElement('select');
 layout.id='agpGraphLayout';
 layout.add(new Option('State diagram','diagram'));
 if(references)layout.add(new Option('Observed references · 3D','reference'));
 const fitted=new Option('2-CST graph · 3D','graph');
 if(bank)layout.add(fitted);
 const lengths=el('graphEdgeLengths'),algo=el('graphEmbeddingMethod'),strength=el('graphProportionStrength');
 const spheres=el('graphSpheres'),ambient=el('graphSphereAmbient'),highlights=el('graphSphereHighlights');
 const fitControls=[lengths,strength,algo],sphereControls=[spheres,ambient,highlights];
 let pairLayout=bank?'graph':'diagram',previousAlgorithm='weighted_grip',singleLayout='diagram';
 lengths.disabled=spheres.disabled=false;lengths.value='proportion';algo.value=previousAlgorithm;
 const layoutLabel=document.createElement('label');
 layoutLabel.append('Graph layout',layout);
 const controls=['graphVertexScale','vertexLabels','graphVertexColor','graphEdgeColor','graphWidthBySize',
  'graphEdgeWidth','graphWidthStrength','graphFadeBySize','graphFadeStrength','graphDegreeFilter','graphMinimumDegree'];
 const layoutNote=document.createElement('small');
 toolbar.replaceChildren(layoutLabel,...fitControls.map(input=>input.closest('label')),layoutNote,
  ...sphereControls.map(input=>input.closest('label')),...controls.map(id=>el(id).closest('label')));
 if(!bank)layoutLabel.title='Add graph-layouts-3d.json beside population.json for the fitted 3D pair graph.';
 for(const id of controls)el(id).disabled=false;
 el('graphVertexScale').closest('label').title='Scale vertex markers. Area represents sample count for 1-CSTs and degree for 2-CSTs.';
 el('graphContent').replaceChildren(area,el('graphDetails'));
 el('graphPanelHeader').replaceChildren(el('featurePanelTitle'),el('maximize-featurePanel'));
 area.replaceChildren(plot);plot.style.display='block';
 el('graphDetails').replaceChildren(el('graphInformation'),document.createElement('hr'),toolbar);
 el('graphVertexCharacteristics').open=false;
 el('graphInformationTitle').removeAttribute('title');
 const names=new Map();
 for(const s of Object.values(data.schemes)){
  if(s.k===1)for(const id of s.cores)names.set(id,s.labels[id]);
 }
 for(const [id,r] of Object.entries(references||{}))names.set(id,r.label);
 // Original population-only releases may lack the reference file. Identify pair-only
 // components by subtracting the known component names from the saved pair label.
 for(const s of Object.values(data.schemes))if(s.k===2)for(const state of s.cores){
  const ids=state.split(','),parts=s.labels[state].split(' + ');
  const missing=ids.filter(id=>!names.has(id)),other=parts.filter(name=>!ids.some(id=>names.get(id)===name));
  if(missing.length===1 && other.length===1)names.set(missing[0],other[0]);
 }
 let scheme,counts,method,selected=null,notify=null;
 function contains(state){return !selected || (selected.edge?state===selected.id:state.split(',').includes(selected.id))}
 const clear=document.createElement('button');clear.type='button';clear.textContent='Clear graph selection';clear.hidden=true;
 el('graphSummary').append(clear);
 const back=el('headerBackSelection'),forward=el('headerForwardSelection'),clearHeader=el('headerClearSelection');
 let history=[null],cursor=0;
 function syncNavigation(){
  selected=history[cursor];clear.hidden=!selected;clearHeader.disabled=!selected;
  back.disabled=cursor===0;forward.disabled=cursor===history.length-1;
 }
 function resetNavigation(){history=[null];cursor=0;syncNavigation()}
 function select(item){
  const next=selected?.id===item?.id && selected?.edge===item?.edge?null:item;
  if(!next&&!selected)return;
  history.splice(cursor+1,Infinity,next);cursor++;syncNavigation();notify();
 }
 back.onclick=()=>{if(cursor>0){cursor--;syncNavigation();notify()}};
 forward.onclick=()=>{if(cursor+1<history.length){cursor++;syncNavigation();notify()}};
 clearHeader.onclick=clear.onclick=()=>select(null);
 function render(){
  if(!scheme)return;
  const pair=scheme.k===2,useFit=pair&&layout.value==='graph',spatial=useFit||layout.value==='reference';
  const vertices=new Map(),edges=[];
  fitted.hidden=!pair;fitted.disabled=!pair;
  for(const c of fitControls)c.closest('label').hidden=!useFit;
  const saved=lengths.value==='reference';
  if(saved && algo.value!=='reference'){previousAlgorithm=algo.value;algo.value='reference'}
  if(!saved && algo.value==='reference')algo.value=previousAlgorithm;
  algo.disabled=saved;strength.disabled=lengths.value!=='proportion';
  el('graphProportionStrengthValue').textContent=strength.value;
  const lit=pair&&spatial&&spheres.checked;
  for(const c of sphereControls)c.closest('label').hidden=!pair||!spatial;
  ambient.disabled=highlights.disabled=!lit;
  el('graphSphereAmbientValue').textContent=ambient.value+'%';
  el('graphSphereHighlightsValue').textContent=highlights.value+'%';
  for(const state of scheme.cores){
   const ids=state.split(','),n=counts.get(state);
   for(const id of ids){
    if(!vertices.has(id))vertices.set(id,{id,name:names.get(id)||('Taxon '+id),degree:0,n:0,support:0});
    const v=vertices.get(id);v.n+=n;v.support=Math.max(v.support,n);if(pair)v.degree++;
   }
   if(pair)edges.push({state,ids,n});
  }
  const all=[...vertices.values()].sort((a,b)=>b.n-a.n||Number(a.id)-Number(b.id));
  const min=pair&&el('graphDegreeFilter').checked?Number(el('graphMinimumDegree').value):0;
  const nodes=all.filter(v=>v.degree>=min),keep=new Set(nodes.map(v=>v.id));
  const visibleEdges=edges.filter(e=>e.ids.every(id=>keep.has(id)));
  const max=Math.max(...counts.values()),scale=Number(el('graphVertexScale').value)/100;
  const largest=Math.max(...all.map(v=>v.n));
  const faded=pair&&el('graphFadeBySize').checked,fadePower=Number(el('graphFadeStrength').value);
  for(const id of controls.slice(4))el(id).closest('label').hidden=!pair;
  el('graphEdgeColor').closest('label').hidden=!pair;
  el('graphMinimumDegree').disabled=!el('graphDegreeFilter').checked;
  el('graphWidthStrength').disabled=!el('graphWidthBySize').checked;
  el('graphFadeStrength').disabled=!faded;
  for(const id of ['graphVertexScale','graphEdgeWidth','graphWidthStrength','graphFadeStrength']){
   el(id+'Value').textContent=el(id).value+({graphVertexScale:'%',graphEdgeWidth:' px'}[id]||'');
  }
  el('featurePanelTitle').textContent=scheme.q+'%-'+scheme.k+'-CST graph';
  el('graphInformationTitle').textContent='Displayed '+scheme.k+'-CST graph';
  el('status').textContent=nodes.length+' of '+all.length+' component taxa'+(pair?' · '+visibleEdges.length+' of '+edges.length+' retained pairs':' · one vertex per retained state');
  el('graphVertexNote').textContent=(pair?'n counts samples in incident pairs. A sample contributes to both endpoints.':'n counts samples in each displayed state.')+' Percentages use the full AGP population. Click a vertex or pair to highlight its samples.';
  const tbody=el('graphVertexRows');tbody.replaceChildren();
  for(const v of all){
   const tr=tbody.insertRow(),button=document.createElement('button');
   button.type='button';button.className='graphVertexName';button.textContent=v.name;button.onclick=()=>select({id:v.id,edge:false});
   tr.insertCell().append(button);for(const value of [v.degree,v.n.toLocaleString(),(100*v.n/data.ids.length).toFixed(2)])tr.insertCell().textContent=value;
  }
  const tick=lengths.value==='proportion'?Math.round(4*Number(strength.value)):0;
  const assignment=el('stateMode').checked?'merged':'pure';
  const key=[tick?assignment:'equal',tick,algo.value].join('/');
  const fit=useFit?(saved?bank.reference:bank.fits[key]):null;
  layoutNote.hidden=!useFit;
  if(useFit)layoutNote.textContent=(saved?'Saved MDS reference. Edge targets are Euclidean distances between the observed reference compositions.':
   tick?'Edge target = 1 + '+strength.value+' × pair count / largest pair count.':'All edge targets are 1.')+
   ' Relative RMS edge-length error: '+(fit.rms*100).toFixed(2)+'%.';
  const pos=useFit?new Map(bank.nodes.map((id,i)=>[String(id),fit.coords[i]])):new Map(all.map((v,i)=>{
   return [v.id,spatial?data.fits[method].coordinates[rows.get(references[v.id].sample)]:
    [0,-i]];
  }));
  const traces=[],type=spatial?'scatter3d':'scatter',axes=spatial?['x','y','z']:['x','y'];
  const coord=ids=>Object.fromEntries(axes.map((a,j)=>[a,ids.map(id=>pos.get(id)[j])]));
  const active=e=>selected && (selected.edge?e.state===selected.id:e.ids.includes(selected.id));
  const lower=new Set();
  for(const e of visibleEdges){
   const [a,b]=e.ids.map(id=>vertices.get(id));
   if(a.degree<=b.degree)lower.add(a.id);
   if(b.degree<=a.degree)lower.add(b.id);
   const ratio=e.n/max,width=Number(el('graphEdgeWidth').value);
   const text=scheme.labels[e.state]+' · '+e.n.toLocaleString()+' samples';
   const pick={id:e.state,edge:true};
   // Fold the 2D edges into arcs beside one column of non-overlapping names.
   // Sampling the line also gives users several places to click a long edge.
   const start=pos.get(a.id),end=pos.get(b.id);
   const path=Array.from({length:25},(_,i)=>{
    const t=i/24,point=start.map((v,j)=>v+(end[j]-v)*t);
    if(!spatial)point[0]=-.43*(Math.abs(start[1]-end[1])/all.length)**.65*Math.sin(Math.PI*t);
    return point;
   });
   traces.push({type,mode:'lines',...Object.fromEntries(axes.map((axis,j)=>[axis,path.map(p=>p[j])])),
    customdata:path.map(()=>pick),text:path.map(()=>text),hovertemplate:'%{text}<extra></extra>',
    line:{color:active(e)?'#d2691e':el('graphEdgeColor').value,width:el('graphWidthBySize').checked?1+(width-1)*ratio**Number(el('graphWidthStrength').value):width},
    opacity:faded?ratio**fadePower:1});
  }
  const showLabels=el('vertexLabels').checked;
  const sizes=nodes.map(v=>scale*(pair?8*Math.sqrt(v.degree):25*Math.sqrt(v.n/largest)));
  const opacities=nodes.map(v=>faded&&lower.has(v.id)?(v.support/max)**fadePower:1);
  // Plotly scatter3d only accepts scalar marker opacity. Apply the fade to each color.
  const rgba=(hex,alpha)=>'rgba('+hex.slice(1).match(/../g).map(h=>parseInt(h,16)).join(',')+','+alpha+')';
  const colorFor=v=>selected?.id===v.id?'#d2691e':el('graphVertexColor').value;
  if(lit){
   const centers=[...pos.values()];
   const span=Math.max(...[0,1,2].map(d=>Math.max(...centers.map(p=>p[d]))-Math.min(...centers.map(p=>p[d]))))||1;
   const material={ambient:Number(ambient.value),highlights:Number(highlights.value)};
   for(const [i,v] of nodes.entries()){
    const degree=visibleEdges.filter(e=>e.ids.includes(v.id)).length;
    const radius=4*Math.sqrt(degree||.25)*scale*span/500;
    const mesh=vertexSphereMesh(pos.get(v.id),radius,material);
    traces.push({...mesh,meta:{graphSphere:v.id},color:colorFor(v),opacity:opacities[i],
     customdata:mesh.x.map(()=>({id:v.id,edge:false})),hovertemplate:v.name+'<br>'+v.n.toLocaleString()+' samples<extra></extra>'});
   }
  }
  traces.push({type,mode:lit?'text':showLabels?'markers+text':'markers',...coord(nodes.map(v=>v.id)),
   visible:lit&&!showLabels?false:true,meta:{agpGraphVertices:true},marker:{size:sizes,color:nodes.map((v,i)=>rgba(colorFor(v),opacities[i]))},
   text:nodes.map(v=>v.name),textposition:spatial?'top center':'middle right',cliponaxis:false,
   customdata:nodes.map(v=>({id:v.id,edge:false,n:v.n,degree:v.degree})),
   hovertemplate:'%{text}<br>%{customdata.n} samples<extra></extra>'});
  const sceneAxis={visible:false},axis={visible:false,fixedrange:false};
  plot.style.height=spatial?'100%':Math.max(area.clientHeight,all.length*27+40)+'px';
  const config={margin:{t:20,b:20,l:10,r:10},showlegend:false,uirevision:[scheme.q,layout.value,layout.value==='reference'?method:''].join('/'),
   xaxis:{...axis,range:pair?[-.48,1]:[-.10,1]},yaxis:{...axis,range:[-all.length,1]},
   scene:{aspectmode:'data',xaxis:sceneAxis,yaxis:sceneAxis,zaxis:sceneAxis}};
  return Plotly.react(plot,traces,config,{responsive:true,displaylogo:false}).then(()=>{
   if(plot._agpClick)return;
   plot._agpClick=true;plot.on('plotly_click',ev=>{const item=ev.points[0]?.customdata;if(item?.id)select({id:item.id,edge:item.edge})});
  });
 }
 toolbar.oninput=event=>{
  if(event.target===layout){if(scheme.k===2)pairLayout=layout.value;else singleLayout=layout.value}
  render();
 };
 return {begin(s){if(s!==scheme)resetNavigation()},selection:()=>selected&&{...selected,name:selected.edge?scheme.labels[selected.id]:names.get(selected.id)},contains,onSelect:fn=>{notify=fn},resize:()=>{if(plot.data)Plotly.Plots.resize(plot)},
  update(s,c,m){if(s!==scheme){layout.value=s.k===2?pairLayout:singleLayout}scheme=s;counts=c;method=m;return render()}};
}
