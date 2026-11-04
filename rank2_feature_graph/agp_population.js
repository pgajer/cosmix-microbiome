// AGP colors and filters are assignments in abundance space. Coordinates come from the saved population fit.
async function showAgpPopulation(data, choices){
 const el=id=>document.getElementById(id), method=el('sampleMethod'),color=el('sampleColorScheme'),
       assign=el('stateMode'),plot=el('samples'),info=el('sampleContext'),selector=el('datasetSelect');
 const title=choices.find(item=>item.id===data.id).title;
 document.title='CoSMiX — '+title;el('sampleTitle').textContent=title;
 el('controlSections').replaceChildren(el('dataControls'),el('stateControls'));
 el('cohortControl').hidden=true;
 el('datasetMessage').textContent=data.ids.length.toLocaleString()+' fecal samples · 340 SILVA taxa';
 el('stateControls').querySelector('.sectionControls').replaceChildren(assign.closest('label'));
 el('panelWorkspace').replaceChildren(el('samplePanel'));el('panelWorkspace').style.display='block';
 el('samplePanel').style.height='100%';
 el('sampleSidePanels').replaceChildren(info);info.style.padding='8px';
 const header=el('samplePanel').querySelector('.sampleHeaderActions');
 header.replaceChildren(color.closest('label'),method.closest('label'));
 el('sampleInfoDivider').remove();
 el('sampleContent').style.gridTemplateColumns='minmax(0,1fr) 8px minmax(240px,36%)';
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
 const ranges=new Map();
 async function draw(){
  const s=data.schemes[color.value],bank=data.fits[method.value],coords=bank.coordinates;
  const xyz=[[],[],[]],colors=[],hover=[],ids=[],counts=new Map(s.cores.map(key=>[key,0]));
  const coreCounts=new Map(counts);
  let core=0;
  for(let i=0;i<data.ids.length;i++){
   const isCore=s.assignment[i]==='core',state=s.merged[i];
   if(isCore){core++;coreCounts.set(state,coreCounts.get(state)+1)}
   if(!assign.checked&&!isCore)continue;
   counts.set(state,counts.get(state)+1);
   ids.push(data.ids[i]);colors.push(stateColors.get(state));
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
  await Plotly.react(plot,[{type:'scatter3d',mode:'markers',x:xyz[0],y:xyz[1],z:xyz[2],ids,
    marker:{size:2.5,color:colors,opacity:0.8},customdata:hover,text:ids,
    hovertemplate:'%{text}<br>%{customdata[0]}<br>%{customdata[1]}<extra></extra>'}],
    {margin:{l:0,r:0,b:0,t:0},uirevision:method.value,scene:{aspectmode:'data',xaxis,yaxis,zaxis}},
    {responsive:true,displaylogo:false});
 }
 for(const control of [method,color,assign])control.onchange=draw;
 await draw();
}
