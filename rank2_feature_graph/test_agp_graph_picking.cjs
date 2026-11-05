const assert=require('assert/strict');
const {agpGraphItemAt,installAgpGraphPicking}=require('./agp_graph_picking.js');
const item=(id,edge=false)=>({id,edge,connection:edge});
const data=[{type:'scatter3d',mode:'lines',meta:{agpGraphEdge:['a','b']},x:[0,100],y:[0,0],z:[0,0],line:{width:2},customdata:[item('a,b',true),item('a,b',true)]},
 {type:'scatter3d',meta:{agpGraphVertices:true},x:[0,100],y:[0,0],z:[0,0],marker:{size:[12,12]},customdata:[item('a'),item('b')]}];
const plot={data,layout:{},querySelectorAll:()=>[]};
const project=p=>({x:p[0],y:p[1],z:p[2]||0});
assert.deepEqual(agpGraphItemAt(plot,0,0,project),item('a'),'Vertex wins over shared edge endpoint');
assert.deepEqual(agpGraphItemAt(plot,50,4,project),item('a,b',true),'Any point along the edge is selectable');
assert.equal(agpGraphItemAt(plot,50,30,project),null);
plot.data=[...data,{type:'mesh3d',meta:{graphSphere:'front'},x:[-5,5],y:[-5,5],z:[-.6,-.4]}];
assert.equal(agpGraphItemAt(plot,0,0,project).id,'front','Front sphere wins at coincident centers');
plot.data.at(-1).opacity=0;assert.equal(agpGraphItemAt(plot,0,0,project).id,'a','Invisible spheres are not targets');
plot.layout.scene={annotations:[{name:'agp-vertex:b',opacity:1}]};
plot.querySelectorAll=()=>[{getAttribute:()=>0,querySelector:()=>({getBoundingClientRect:()=>({left:-2,right:8,top:-2,bottom:8,width:10,height:10})})}];
assert.equal(agpGraphItemAt(plot,1,1,project).id,'b','Named label takes priority over nearby sphere/edge');
const handlers={},selected=[];let revision=0;
const target={data:[],layout:{},querySelectorAll:()=>[],on:(event,fn)=>handlers[event]=fn,addEventListener:(event,fn)=>handlers[event]=fn};
installAgpGraphPicking(target,x=>selected.push(x),()=>revision);
const event=(name,more={})=>handlers[name]({button:0,pointerId:1,clientX:50,clientY:50,target,...more});
const pick=x=>handlers.plotly_click({points:[{customdata:x}]});
const flush=()=>new Promise(resolve=>setTimeout(resolve,5));
(async()=>{
 event('pointerdown');for(let i=0;i<40;i++)pick(item('a'));assert.equal(selected.length,0);
 event('pointerup');await flush();assert.deepEqual(selected,[item('a')]);
 for(let i=0;i<40;i++)pick(item('b'));await flush();assert.equal(selected.length,1,'Late frame events ignored');
 event('pointerdown');pick(item('b'));event('pointermove',{clientX:80});event('pointermove');event('pointerup');await flush();assert.equal(selected.length,1,'Drag returning to start does not select');
 for(const cancel of ['pointercancel','blur','wheel']){event('pointerdown');pick(item('b'));event(cancel);event('pointerup');await flush();assert.equal(selected.length,1)}
 event('pointerdown',{ctrlKey:true});pick(item('b'));event('pointerup');await flush();assert.equal(selected.length,1);
 event('pointerdown');pick(item('b'));event('pointerup');revision++;await flush();assert.equal(selected.length,1,'Stale queued click ignored');
 event('pointerdown');event('pointerup');pick(item('a,b',true));await flush();assert.deepEqual(selected[1],item('a,b',true),'SVG release-time pick accepted once');
 event('pointerdown');pick(item('b'));assert.equal(handlers.pointerleave,undefined);event('pointerup');await flush();assert.deepEqual(selected[2],item('b'),'2D drag-cover leave retains the stationary click');
 event('pointerdown');event('blur',{target:{tagName:'INPUT'}});pick(item('a'));event('pointerup');await flush();assert.deepEqual(selected[3],item('a'),'Moving focus from a control to the canvas retains the click');
 console.log('PASS label/sphere/edge hit priority, continuous edge picking, repeated events, drag/modifier/cancel and stale-render rejection');
})().catch(e=>{console.error(e);process.exit(1)});
