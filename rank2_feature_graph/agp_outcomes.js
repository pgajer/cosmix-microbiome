// Saved respondent-probability estimates. This module never fits a model.
const AgpOutcomes=(()=>{
 const outcomes={seasonal_allergies:'Seasonal allergies',skin_condition:'Skin condition',ibs:'IBS'};
 const methods={knn:'Ordinary kNN',case_raw:'Nearest cases · raw',case_corrected:'Nearest cases · corrected'};
 const policies={index:'Index sample (primary)',all_visits:'All visits (sensitivity)'};
 const scopes={global:'Global fit',state:'Separate 70%-1-CST fits'};
 const kinds={outer:'Held-out · nested CV',final:'Full-reference estimates'};
 const controls=['agpOutcomeEnabled','agpOutcome','agpOutcomeMethod','agpOutcomePolicy','agpOutcomeScope','agpOutcomeKind'];
 function probabilityScale(values){
  const sorted=values.filter(v=>typeof v==='number'&&Number.isFinite(v)).sort((a,b)=>a-b);
  if(!sorted.length)return null;
  // Linear interpolation at (n - 1) p (R quantile type 7); unavailable values are excluded.
  const quantile=p=>{const pos=(sorted.length-1)*p,i=Math.floor(pos),f=pos-i;return sorted[i]+f*(sorted[Math.min(i+1,sorted.length-1)]-sorted[i])};
  const lower=quantile(.025),upper=quantile(.975),collapsed=lower===upper;
  const pad=Math.max(1e-6,Math.abs(lower)*.01);
  const cmin=collapsed?Math.max(0,lower-pad):lower,cmax=collapsed?Math.min(1,upper+pad):upper;
  const digits=collapsed?2:Math.min(6,Math.max(2,Math.ceil(-Math.log10((upper-lower)*100/4))+1));
  const percent=v=>(100*v).toFixed(digits)+'%';
  const tickvals=collapsed?[lower]:Array.from({length:5},(_,i)=>lower+(upper-lower)*i/4);
  const ticktext=tickvals.map((v,i)=>(collapsed?'':i===0?'≤':i===4?'≥':'')+percent(v));
  const description=collapsed?'Both color limits equal '+percent(lower)+'.': 'Color range: '+percent(lower)+'–'+percent(upper)+'.';
  return {lower,upper,cmin,cmax,tickvals,ticktext,description:description+' Limits are the 2.5th and 97.5th percentiles of all available estimates for these model settings, held fixed across selections and maps. Tail colors are clipped; hover values are unchanged.'};
 }
 function validate(bank,population){
  if(!bank)return null;
  if(bank.version!==1||bank.identity!=='2805acb3d1da21309e0e972bc8cc6d05489ebc3138776c60c90130b454c870fd'||
    ['countSha256','featureSha256'].some(k=>bank[k]!==population[k]))throw Error('AGP outcome analysis does not match this population.');
  const rows=new Map(bank.sample.map((id,i)=>[id,i]));
  if(rows.size!==bank.sample.length||bank.state.length!==bank.sample.length)throw Error('Duplicate or mismatched AGP outcome sample IDs.');
  const populationRows=new Map(population.ids.map((id,i)=>[id,i]));
  for(const [id,row] of rows)if(!populationRows.has(id)||population.schemes['70%-1-CST'].merged[populationRows.get(id)]!==bank.state[row])
   throw Error('AGP outcome frozen 70%-1-CST memberships differ.');
  const index=new Set(bank.index);
  if(index.size!==bank.index.length||[...index].some(i=>!Number.isInteger(i)||i<0||i>=rows.size))throw Error('Invalid AGP outcome index samples.');
  for(const p of Object.keys(policies))for(const o of Object.keys(outcomes))for(const m of Object.keys(methods))for(const s of Object.keys(scopes))for(const k of Object.keys(kinds)){
   const values=bank.series[[p,o,m,s,k].join('__')];
   if(!Array.isArray(values)||values.length!==rows.size||values.some((v,i)=>
    (p==='all_visits'||index.has(i))?(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1):v!==null))throw Error('Invalid AGP outcome probabilities or unavailable mask.');
  }
  for(const o of Object.keys(outcomes))if(bank.outcomes[o]?.length!==rows.size||bank.outcomes[o].some(v=>v!==null&&v!==0&&v!==1))throw Error('Invalid AGP outcome answers.');
  return {bank,rows,index};
 }
 function install(bank,population,parent,changed){
  const section=document.createElement('details');section.id='agpOutcomeControls';section.open=true;
  const summary=document.createElement('summary');summary.textContent='Outcome estimates';section.append(summary);
  const inputs={};
  function add(id,label,options,title){
   const wrap=document.createElement('label'),input=document.createElement(options?'select':'input');
   input.id=id;inputs[id]=input;
   if(options)input.append(...Object.entries(options).map(([v,t])=>new Option(t,v)));else input.type='checkbox';
   wrap.style.cssText=options?'display:grid;gap:4px;margin:9px 0':'display:flex;gap:5px;margin:9px 0;align-items:center;white-space:normal';
   if(options)wrap.append(label,input);else wrap.append(input,label);
   input.style.maxWidth='100%';wrap.title=title||'';section.append(wrap);input.onchange=changed;
   return input;
  }
  const enabled=add(controls[0],'Color by outcome probability',null,'Changes colors only. The CST coverage, selected samples, graph and saved embedding remain unchanged.');
  add(controls[1],'Outcome',outcomes,'Recorded survey answer: yes/no for seasonal allergies; reported medical, alternative-practitioner or self-diagnosis versus no condition for skin condition and IBS.');
  add(controls[2],'Estimator',methods,'Ordinary kNN uses k nearest participants. Nearest-case methods expand until k cases; the corrected method adjusts for that stopping rule. k was selected separately inside participant folds.');
  add(controls[3],'Sample policy',policies,'Primary: one fixed, outcome-independent index sample and its own answer. All visits: each reference participant contributes their nearest answering visit to the query.');
  add(controls[4],'Fitting population',scopes,'Separate fits always use the eight frozen merged 70%-1-CSTs, even when the explorer displays another coverage or pure states.');
  add(controls[5],'Estimate type',kinds,'Held-out: participant excluded in an outer fold, with k tuned in inner participant folds. Full-reference: k tuned by five-fold CV, then the query participant excluded from the responding reference.');
  const note=document.createElement('p');note.style.fontSize='12px';section.append(note);
  let validated=null,error=null;
  try{validated=validate(bank,population)}catch(e){error=e.message}
  if(!validated){
   enabled.disabled=true;
   note.textContent=error||'Install the separately supplied AGP outcome estimates to enable probability coloring.';
  }else{
   note.textContent='Probabilities among survey respondents, not causal effects or clinical risk estimates. All fits use intrinsic Euclidean length on the max-normalized 340-taxon surface; the map selector changes display coordinates only.';
   const help=document.createElement('details'),h=document.createElement('summary');h.textContent='Methods and interpretation';help.append(h);
   for(const text of [
    'Question: how does the probability of a reported condition vary with the community profile? The three estimators average nearby responding participants using a fixed intrinsic distance, not distances in this 3D plot.',
    'Ordinary kNN averages outcomes of k nearest participants. Raw nearest-case probability is k/T; corrected probability is (k−1)/(T−1), where T is the number of ranked participants needed to reach k positive cases. Thus k counts participants for kNN and cases for the nearest-case methods.',
    'Intrinsic distance is the shortest Euclidean-length path constrained to the max-normalized surface. It is not ambient Euclidean distance and not a Fermat density-weighted distance.',
    'The color scale runs from the 2.5th to the 97.5th percentile of available predictions for the selected outcome, estimator, sample policy, fitting population and estimate type. Colors beyond these limits are clipped (winsorized); actual probabilities in hover text are unchanged. These limits use the full prediction set, so selecting a state or switching maps does not rescale the colors. Gray means an unavailable estimate or graph-boundary context. A missing survey answer does not imply an unavailable estimate.',
    'Held-out predictions use five outer participant folds and three inner folds for choosing k. They support evaluation on held-out participants. Full-reference estimates exclude the query participant but use k tuned on the full responding reference; they are exploration estimates, not an independent validation.',
    'Predictive improvements over prevalence were modest. Separate-state fits did not consistently outperform global fits. These estimates describe responding participants and do not establish treatment effects or diagnoses.'
   ]){const p=document.createElement('p');p.textContent=text;help.append(p)}
   if(bank.reportPdf){const pdf=document.createElement('a');pdf.textContent='Download full methods and results (PDF)';pdf.download='AGP-conditional-outcome-estimates.pdf';pdf.href='data:application/pdf;base64,'+bank.reportPdf;help.append(pdf)}
   section.append(help);
  }
  parent.append(section);
  const scaleCache=new Map();
  function current(){
   const value=id=>inputs[id].value;
   const policy=value(controls[3]),outcome=value(controls[1]),method=value(controls[2]),scope=value(controls[4]),kind=value(controls[5]);
   const active=Boolean(validated&&enabled.checked);
   for(const id of controls.slice(1))inputs[id].disabled=!active;
   const key=[policy,outcome,method,scope,kind].join('__');
   if(active&&!scaleCache.has(key))scaleCache.set(key,probabilityScale(bank.series[key]));
   return {active,policy,outcome,method,scope,kind,key,scale:active?scaleCache.get(key):null,
    title:outcomes[outcome]+' · '+methods[method],description:scopes[scope]+' · '+policies[policy]+' · '+kinds[kind]};
  }
  function lookup(id,setting){
   const row=validated?.rows.get(id);
   if(row===undefined)return {probability:null,answer:null,reason:'No participant linkage',state:null};
   const probability=bank.series[setting.key][row],answer=bank.outcomes[setting.outcome][row];
   return {probability,answer,state:bank.labels[bank.state[row]],reason:probability===null?'Non-index visit under the index-sample policy':null};
  }
  function annotate(samples,setting,highlighted){
   if(!setting.active)return [samples];
   const available=[],unavailable=[],context=[];
   const values=samples.ids.map((id,i)=>{
    const v=lookup(id,setting);(highlighted[i]?v.probability===null?unavailable:available:context).push(i);
    return [...samples.customdata[i],v.probability===null?'Unavailable: '+v.reason:(100*v.probability).toFixed(2)+'%',
     v.answer===null?'No recorded answer':v.answer?'Positive':'Negative',v.state||'Unavailable',
     highlighted[i]?'':'Context outside the selected graph boundary'];
   });
   const trace=(indices,meta,marker)=>({...samples,meta:{agpSamples:true,...meta},
    ...Object.fromEntries(['x','y','z','ids','text'].map(k=>[k,indices.map(i=>samples[k][i])])),
    customdata:indices.map(i=>values[i]),marker:{...samples.marker,...marker},
    hovertemplate:samples.hovertemplate.replace('<extra></extra>','<br>Estimated probability: %{customdata[2]}<br>Observed answer: %{customdata[3]}<br>Frozen 70%-1-CST: %{customdata[4]}<br>%{customdata[5]}<extra></extra>')});
   const scale=setting.scale;
   const result=[trace(available,{outcome:setting.key},{color:available.map(i=>Math.max(scale.lower,Math.min(scale.upper,lookup(samples.ids[i],setting).probability))),colorscale:'Viridis',cmin:scale.cmin,cmax:scale.cmax,showscale:true,
    colorbar:{title:{text:'Probability'},tickvals:scale.tickvals,ticktext:scale.ticktext,thickness:12,len:.65,x:1}})];
   if(unavailable.length)result.push(trace(unavailable,{unavailable:true},{color:'#9ca3af',opacity:.3}));
   if(context.length)result.push(trace(context,{context:true},{color:'#dedede',opacity:.25}));
   return result;
  }
  return {current,lookup,annotate,section};
 }
 return {validate,install,controls,probabilityScale,outcomes,methods,policies,scopes,kinds};
})();
if(typeof module!=='undefined')module.exports=AgpOutcomes;
