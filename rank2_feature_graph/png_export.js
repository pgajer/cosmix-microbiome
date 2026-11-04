// Freeze the live Plotly scene so changing PNG resolution preserves the view.
function pngExportScene(plot,camera){
 const scene=plot._fullLayout?.scene?._scene,result=JSON.parse(JSON.stringify(plot.layout?.scene||{}));
 result.camera=camera;const ratio=plot._fullLayout?.scene?.aspectratio;
 if(ratio){result.aspectmode='manual';result.aspectratio={...ratio}}
 for(const [i,axis] of ['xaxis','yaxis','zaxis'].entries()){
  const a=plot._fullLayout?.scene?.[axis],bounds=scene?.glplot?.bounds;
  // Plotly 2.25.2 autoranged axes can retain placeholder layout ranges.
  // Export the bounds used by WebGL, converted back from scene scale.
  const range=bounds&&scene.dataScale?bounds.map(b=>a.l2r(b[i]/scene.dataScale[i])):a?.range;
  if(a&&range)result[axis]={...result[axis],type:a.type,range:[...range],autorange:false};
 }
 return result;
}

function installPngExportDialog(el,capture){
 const dialog=el('viewExportDialog'),preview=el('viewExportPreview'),message=el('viewExportMessage'),download=el('viewExportDownload');
 let snapshot=null,version=0,imageURL=null;
 const clone=x=>JSON.parse(JSON.stringify(x)),frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 async function imageFrom(url){const img=new Image();img.src=url;await img.decode();return img}
 function textLines(ctx,text,width){
  const lines=[];for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/)){if(!word)continue;if(ctx.measureText(line+(line?' ':'')+word).width>width&&line){lines.push(line);line=''}let part=word;while(ctx.measureText(part).width>width){let cut=part.length-1;while(cut>1&&ctx.measureText(part.slice(0,cut)).width>width)cut--;if(line){lines.push(line);line=''}lines.push(part.slice(0,cut));part=part.slice(cut)}line+=(line?' ':'')+part}lines.push(line)}return lines;
 }
 async function render(){
  if(!snapshot)return;const token=++version,s=snapshot,scale=Number(el('viewExportScale').value),include=el('viewExportInfo').checked;
  download.hidden=true;preview.hidden=true;message.textContent='Preparing PNG…';let renderer=null;
  try{
   let url;if(s.svg){url='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s.svg)}else{
    renderer=document.createElement('div');renderer.style.cssText=`position:fixed;left:-100000px;top:0;width:${s.width}px;height:${s.height}px;pointer-events:none`;document.body.appendChild(renderer);
    await Plotly.newPlot(renderer,clone(s.data),clone(s.layout),{staticPlot:true,displayModeBar:false,plotGlPixelRatio:2});
    await Plotly.relayout(renderer,{'scene.camera':clone(s.layout.scene.camera)});await frame();
    url=await Plotly.toImage(renderer,{format:'png',width:s.width,height:s.height,scale});
   }
   const plotImage=await imageFrom(url),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),infoWidth=include?340:0,pad=include?16:0;
   ctx.font='13px Arial';const rows=include?s.rows.map(row=>({...row,lines:textLines(ctx,row.text,infoWidth-40)})):[];
   const titleLines=include?textLines(ctx,s.title,s.width+infoWidth-32):[],heading=include?titleLines.length*22+24:0;
   const height=Math.max(s.height,rows.reduce((n,row)=>n+row.lines.length*18+12,16));
   canvas.width=(s.width+infoWidth+pad)*scale;canvas.height=(height+heading)*scale;ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width/scale,canvas.height/scale);
   ctx.drawImage(plotImage,0,heading,s.width,s.height);
   if(include){ctx.fillStyle='#183743';ctx.font='bold 16px Arial';titleLines.forEach((line,i)=>ctx.fillText(line,16,24+i*22));let y=heading+20;
    for(const row of rows){ctx.font='13px Arial';if(row.color){ctx.fillStyle=row.color;ctx.fillRect(s.width+pad,y-10,10,10)}ctx.fillStyle='#183743';for(const line of row.lines){ctx.fillText(line,s.width+pad+16,y);y+=18}y+=12}
   }
   const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG creation failed')),'image/png'));
   if(token!==version)return;if(imageURL)URL.revokeObjectURL(imageURL);imageURL=URL.createObjectURL(blob);preview.src=imageURL;preview.hidden=false;download.href=imageURL;download.download=s.filename+`-${scale}x.png`;download.hidden=false;
   message.textContent=`${canvas.width} × ${canvas.height} pixels. Captured view; changing export options keeps the same camera.`;
  }catch(error){if(token===version)message.textContent='Could not create PNG: '+error.message;console.error(error)}finally{if(renderer){Plotly.purge(renderer);renderer.remove()}}
 }
 async function open(kind){
  const token=++version;snapshot=null;preview.hidden=true;download.hidden=true;message.textContent='Capturing current view…';
  el('viewExportScale').disabled=el('viewExportInfo').disabled=true;dialog.showModal();
  try{const captured=await capture(kind);if(token!==version||!dialog.open)return;snapshot=captured;await render()}catch(error){if(token===version)message.textContent='Could not capture view: '+error.message;console.error(error)}finally{el('viewExportScale').disabled=el('viewExportInfo').disabled=false}
 }
 el('viewExportScale').onchange=el('viewExportInfo').onchange=render;
 el('viewExportClose').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{++version;snapshot=null;if(imageURL)URL.revokeObjectURL(imageURL);imageURL=null;preview.removeAttribute('src');download.removeAttribute('href')});
 return open;
}
