// Optional saved face rotations: the renderer never refits or changes membership.
function unfoldedAsset(){return matchingUnfoldedBank('datasetUnfoldedEmbeddings')}
function unfoldedEdgeAsset(){return matchingUnfoldedBank('datasetUnfoldedEdgeEmbeddings')}
function matchingUnfoldedBank(field){
 const bank=BUNDLE_PACK[field]?.[META.id];
 return bank?.version===1&&bank.dataset===META.id&&bank.baseRevision===META.revision&&bank.analysisRevision===BUNDLE_PACK.participants?.[META.id]?.analysisRevision&&(META.id!=='comb-V3V4-tx'||bank.displayRevision===BUNDLE_PACK.combDisplay?.revision)&&(field!=='datasetUnfoldedEdgeEmbeddings'||bank.scope?.complete===true)?bank:null;
}
const unfoldedDecoded=new WeakMap(),unfoldedEdgeChoices=new Map();
let unfoldedAnchorFeatureId=null;
function unfoldedEdgeSelectionKey(){return selectedVertex===null&&selected!==null?datasetMaxNormalizedContext('group',selected):null}
function unfoldedEdgeChoiceKey(){const bank=unfoldedEdgeAsset(),key=unfoldedEdgeSelectionKey();return bank&&key?JSON.stringify([META.id,bank.revision,key]):null}
function unfoldedAnchorLabel(id){return typeof taxonDisplayLabel==='function'?taxonDisplayLabel(DATA.featureNames?.[id]||String(id)):String(id)}
function unfoldedEntry(method=maxNormalizedMethod()){
 if(method!=='maxnorm-euclidean'||participant.active||rank3UsesSamples()||candidateActive()||pureCoverageActive())return null;
 let bank,source;
 if(selectedVertex!==null){
  bank=unfoldedAsset();const key=bank?.contexts[datasetMaxNormalizedContext('vertex',selectedVertex)];source=key&&bank.fits[key+':euclidean'];
  if(source&&source.anchor!==selectedVertex-1)throw Error('Unfolded fit anchor differs from the selected vertex.');
 }else if(selected!==null){
  bank=unfoldedEdgeAsset();const selection=bank?.selections[unfoldedEdgeSelectionKey()];
  if(!selection?.endpoints.includes(unfoldedAnchorFeatureId))return null;
  const context=JSON.stringify([...JSON.parse(unfoldedEdgeSelectionKey()),String(unfoldedAnchorFeatureId)]);
  source=bank.fits[bank.contexts[context]];
  if(source&&(source.anchor!==unfoldedAnchorFeatureId-1||source.edge!==selected))throw Error('Unfolded edge or anchor differs from the selection.');
 }
 if(!source)return null;
 let fit=unfoldedDecoded.get(source);
 if(!fit){fit={...source,coordinates:decodeSavedCoordinates(source),label:'Max-normalized Euclidean · Unfolded faces',unfolded:true,unfoldedBankRevision:bank.revision};unfoldedDecoded.set(source,fit)}
 return fit;
}
function unfoldedEnabled(){return el('unfoldFaces')?.checked===true&&!!unfoldedEntry()}
function saveUnfoldedEdgeChoice(){const key=unfoldedEdgeChoiceKey();if(key)unfoldedEdgeChoices.set(key,{anchor:unfoldedAnchorFeatureId,enabled:el('unfoldFaces').checked})}
function restoreUnfoldedChoice(state){
 unfoldedAnchorFeatureId=Number.isInteger(state.unfoldAnchorFeatureId)?state.unfoldAnchorFeatureId:null;
 el('unfoldFaces').checked=state.unfoldFaces===true;
 // Legacy bookmarks intentionally restore their ordinary coordinates, not a new default.
 saveUnfoldedEdgeChoice();
}
function syncUnfoldedControls(){
 const selection=selectedVertex!==null||selected!==null;
 const local=selection&&!participant.active&&!rank3UsesSamples()&&!candidateActive()&&!pureCoverageActive()&&sampleUsesLocalFit();
 const fit=local?localSelectionFit():null,visible=!!fit&&fit.fittingScope!=='population-restriction';
 const edgeSelection=visible&&selectedVertex===null?unfoldedEdgeAsset()?.selections[unfoldedEdgeSelectionKey()]:null;
 if(edgeSelection&&maxNormalizedMethod()==='maxnorm-euclidean'){
  const key=unfoldedEdgeChoiceKey(),choice=unfoldedEdgeChoices.get(key)||{anchor:edgeSelection.defaultAnchorFeatureId,enabled:true};
  unfoldedAnchorFeatureId=edgeSelection.endpoints.includes(choice.anchor)?choice.anchor:edgeSelection.defaultAnchorFeatureId;
  el('unfoldFaces').checked=choice.enabled;saveUnfoldedEdgeChoice();
 }
 const anchor=el('unfoldAnchor');if(anchor){
  anchor.parentElement.hidden=!edgeSelection;anchor.disabled=maxNormalizedMethod()!=='maxnorm-euclidean';
  anchor.innerHTML=edgeSelection?edgeSelection.endpoints.map(id=>`<option value="${id}">${esc(unfoldedAnchorLabel(id))}</option>`).join(''):'';
  anchor.value=String(unfoldedAnchorFeatureId??'');
  anchor.title='Unfold around this endpoint. The initial choice has the higher summed original relative abundance across the full eligible dataset, counting each observation. Manual and saved choices take precedence.';
 }
 const available=visible&&!!unfoldedEntry(),checked=available&&el('unfoldFaces').checked;
 const unavailable=maxNormalizedMethod()!=='maxnorm-euclidean'?'Unfolding requires Max-normalized · Euclidean and a matching saved unfolded fit.':
  selectedVertex===null?'No unfolded fit has been supplied for this edge view.':
  'No matching unfolded fit has been supplied for this vertex, cohort, state mode and coverage.';
 for(const id of ['unfoldFaces','panelUnfoldFaces']){
  const control=el(id);if(!control)continue;control.disabled=!available;control.checked=checked;
  if(id==='unfoldFaces')control.parentElement.hidden=!visible;
  control.parentElement.title=available?'Rotate neighboring dominant faces around the chosen anchor face, then use the saved local Euclidean 3D fit. Off restores the ordinary fit. Samples and colors stay the same. Cuts between other faces remain.':unavailable;
 }
}
function installUnfoldedControls(){
 for(const id of ['unfoldFaces','panelUnfoldFaces'])el(id).onchange=()=>{
  const checked=el(id).checked;
  if(!unfoldedEntry()){syncUnfoldedControls();return}
  el('unfoldFaces').checked=!checked;rememberSelection();
  for(const other of ['unfoldFaces','panelUnfoldFaces'])el(other).checked=checked;
  saveUnfoldedEdgeChoice();return refreshSamples();
 };
 const anchor=el('unfoldAnchor');if(anchor)anchor.onchange=()=>{
  const next=Number(anchor.value),selection=unfoldedEdgeAsset()?.selections[unfoldedEdgeSelectionKey()];
  if(!selection?.endpoints.includes(next))return syncUnfoldedControls();
  rememberSelection();unfoldedAnchorFeatureId=next;saveUnfoldedEdgeChoice();return refreshSamples();
 };
}
function unfoldedStressRows(rows,anchor){
 return rows.map(row=>{
  const maximum=Math.max(...row.map(v=>v[1]));if(!(maximum>0))throw Error('Empty unfolded composition');
  const normalized=row.map(([k,v])=>[k,v/maximum]).sort((a,b)=>a[0]-b[0]);
  const anchorValue=normalized.find(([k])=>k===anchor)?.[1]||0;
  const dominant=anchorValue===1?anchor:normalized.find(([,v])=>v===1)[0];
  return normalized.filter(([k])=>k!==anchor).map(([k,v])=>[k,k===dominant&&dominant!==anchor?2-anchorValue:v]);
 });
}
function unfoldedStress(view,ordered,rows){
 const positions=new Map(view.profiles.map((p,i)=>[p,view.coordinates[i]]));
 if(ordered.some(p=>!positions.get(p.profile)?.every((v,k)=>v===p.xyz[k])))throw Error('Displayed coordinates differ from the unfolded fit.');
 const all=ordered.length===positions.size&&ordered.every(p=>positions.has(p.profile));
 const result=all?view.evaluation:cachedEmbeddingStress(JSON.stringify([view.unfoldedBankRevision||unfoldedAsset()?.revision,view.anchor,ordered]),()=>evaluateEmbeddingStress(unfoldedStressRows(rows,view.anchor),ordered.map(p=>p.xyz)));
 const starts=(view.validation?.seeds||[]).filter(s=>Number.isFinite(s.relativeRms));
 const diagnostics=starts.length?' Full fitted selection: tested start RMS errors '+starts.map(s=>'seed '+s.seed+': '+(100*s.relativeRms).toFixed(3)+'%').join('; ')+'. Selected seed '+view.solver.seed+'.'+(Math.max(...starts.map(s=>s.relativeRms))-Math.min(...starts.map(s=>s.relativeRms))>.03?' Initialization-sensitive: the tested starts differ by more than 3 percentage points.':'')+' Completing '+view.solver.epochs+' SGD epochs does not certify convergence.':view.solver.backend==='analytic'?' Analytic layout; no iterative fitting.':'';
 setEmbeddingStress('sampleStress',result,'Target: Euclidean distances after rotating dominant faces onto the anchor face ('+unfoldedAnchorLabel(view.anchor+1)+') and dropping its constant coordinate. No stretching. Distances within each face are preserved; cuts between different neighboring faces remain. This is not a global surface-geodesic distance. Evaluated on displayed distinct profiles, excluding reference markers. The ordinary and unfolded fits have different targets; their stress scores are not a common method ranking.'+diagnostics);
 if(el('sampleStress'))el('sampleStress').title+=diagnostics;
 return true;
}
