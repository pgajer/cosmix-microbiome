// Plotly 2.25.2 adapter: resolve hits against the visible graph, then navigate
// once on pointer release. Never let a drag or a redraw generate a selection.
function agpGraphScreenPoint(plot,point){
 const scene=plot._fullLayout?.scene?._scene,params=scene?.glplot?.cameraParams;
 if(point.length===3){
  if(!params||!scene.container?.getBoundingClientRect)return null;
  let v=[...point.map((x,i)=>x*scene.dataScale[i]),1];
  for(const name of ['model','view','projection']){const m=params[name];v=[0,1,2,3].map(j=>v.reduce((sum,x,i)=>sum+m[4*i+j]*x,0))}
  if(v[3]<=0||!v.every(Number.isFinite))return null;
  const r=scene.container.getBoundingClientRect(),z=v[2]/v[3];
  return z>=-1&&z<=1?{x:r.left+(v[0]/v[3]+1)*r.width/2,y:r.top+(1-v[1]/v[3])*r.height/2,z}:null;
 }
 const {xaxis,yaxis}=plot._fullLayout||{};
 if(!xaxis?.l2p||!yaxis?.l2p)return null;
 const r=plot.getBoundingClientRect();
 return {x:r.left+xaxis._offset+xaxis.l2p(point[0]),y:r.top+yaxis._offset+yaxis.l2p(point[1]),z:0};
}
function agpGraphLabelAt(plot,x,y){
 const annotations=plot.layout?.scene?.annotations||[];
 for(const node of [...plot.querySelectorAll('.annotation-scene')].reverse()){
  const a=annotations[Number(node.getAttribute('data-index'))],r=node.querySelector('.annotation-text')?.getBoundingClientRect();
  if(a?.name?.startsWith('agp-vertex:')&&a.opacity!==0&&r?.width&&r.height&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom)
   return {id:a.name.slice(11),edge:false};
 }
 return null;
}
function agpGraphItemAt(plot,x,y,project=point=>agpGraphScreenPoint(plot,point)){
 const label=agpGraphLabelAt(plot,x,y);if(label)return label;
 const vertices=[],edges=[];
 for(const t of plot.data||[]){
  if(t.visible===false||t.visible==='legendonly'||t.opacity===0)continue;
  const axes=t.type==='scatter' ? ['x','y']:['x','y','z'];
  if(t.meta?.graphSphere){
   const center=axes.map(a=>(Math.min(...t[a])+Math.max(...t[a]))/2),p=project(center);if(!p)continue;
   const radius=(Math.max(...t.x)-Math.min(...t.x))/2;
   const offsets=axes.map((_,j)=>project(center.map((v,k)=>v+(j===k?radius:0))));
   const size=offsets.every(Boolean)?Math.sqrt(offsets.reduce((s,o)=>s+(o.x-p.x)**2+(o.y-p.y)**2,0)/2):6;
   if(Math.hypot(x-p.x,y-p.y)<=Math.max(7,size+3))vertices.push({p,item:{id:t.meta.graphSphere,edge:false}});
  }else if(t.meta?.agpGraphVertices){
   for(let i=0;i<t.x.length;i++){
    const p=project(axes.map(a=>t[a][i])),size=Array.isArray(t.marker?.size)?t.marker.size[i]:t.marker?.size||8;
    if(p&&Math.hypot(x-p.x,y-p.y)<=Math.max(7,size/2+3))vertices.push({p,item:t.customdata[i]});
   }
  }else if(t.meta?.agpGraphEdge){
   for(let i=1;i<t.x.length;i++){
    const a=project(axes.map(k=>t[k][i-1])),b=project(axes.map(k=>t[k][i]));if(!a||!b)continue;
    const dx=b.x-a.x,dy=b.y-a.y,d2=dx*dx+dy*dy;
    if(!d2)continue;
    const u=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/d2));
    const distance=Math.hypot(x-a.x-u*dx,y-a.y-u*dy);
    if(distance<=Math.max(5,(t.line?.width||1)/2+3))edges.push({distance,z:a.z+(b.z-a.z)*u,item:t.customdata[i]});
   }
  }
 }
 vertices.sort((a,b)=>a.p.z-b.p.z||Math.hypot(a.p.x-x,a.p.y-y)-Math.hypot(b.p.x-x,b.p.y-y));
 edges.sort((a,b)=>a.distance-b.distance||a.z-b.z);
 return vertices[0]?.item||edges[0]?.item||null;
}
function installAgpGraphPicking(plot,select,revision){
 if(plot._agpClick)return;
 plot._agpClick=true;
 let press=null,released=null,token=0;
 const scope=plot.ownerDocument?.defaultView||plot;
 const clean=item=>typeof item?.id==='string'&&typeof item.edge==='boolean'?{id:item.id,edge:item.edge,connection:item.connection===true}:null;
 plot.on('plotly_click',event=>{
  const click=press||released;
  if(click&&!click.moved&&!click.point)click.point=clean(event.points?.[0]?.customdata);
 });
 plot.addEventListener('pointerdown',event=>{
  released=null;++token;
  press=event.button===0&&!event.ctrlKey&&!event.altKey&&!event.shiftKey&&!event.metaKey?
   {x:event.clientX,y:event.clientY,pointer:event.pointerId,token,revision:revision(),label:agpGraphLabelAt(plot,event.clientX,event.clientY),moved:false,point:null}:null;
 },true);
 scope.addEventListener('pointermove',event=>{
  if(press&&event.pointerId===press.pointer&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>=5)press.moved=true;
 },true);
 scope.addEventListener('pointerup',event=>{
  if(!press||event.pointerId!==press.pointer)return;
  const click=press;press=null;
  if(click.moved||Math.hypot(event.clientX-click.x,event.clientY-click.y)>=5)return;
  const hit=agpGraphItemAt(plot,event.clientX,event.clientY);
  // Labels name an exact vertex. Require the same label at press and release.
  const label=agpGraphLabelAt(plot,event.clientX,event.clientY);
  const item=click.label&&click.label.id===label?.id?label:hit;
  const spatial=!!plot._fullLayout?.scene?._scene;
  released=click;
  setTimeout(()=>{
   if(released===click)released=null;
   if(click.token!==token||click.revision!==revision())return;
   const chosen=clean(item||(!spatial&&click.point));if(chosen)select(chosen);
  },0);
 },true);
 const cancel=()=>{press=null;released=null;++token};
 scope.addEventListener('pointercancel',cancel,true);
 // A checkbox losing focus when the canvas is clicked is not a window blur.
 scope.addEventListener('blur',event=>{if(event.target===scope)cancel()},true);
 plot.addEventListener('wheel',cancel,true);
 // Plotly's 2D drag cover emits pointerleave even for a stationary press.
 // Window-level motion/release and blur/cancel handle leaving the plot instead.
}
if(typeof module!=='undefined'&&module.exports)module.exports={agpGraphScreenPoint,agpGraphLabelAt,agpGraphItemAt,installAgpGraphPicking};
