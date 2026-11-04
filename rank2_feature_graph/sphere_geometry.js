// Shared mesh, material and light for 3D graph vertices.
const graphSphereMesh=(()=>{
 const points=[[0,0,1]],i=[],j=[],k=[],rings=12,sectors=24;
 for(let r=1;r<rings;r++)for(let s=0;s<sectors;s++){const a=Math.PI*r/rings,b=2*Math.PI*s/sectors;points.push([Math.sin(a)*Math.cos(b),Math.sin(a)*Math.sin(b),Math.cos(a)])}
 const bottom=points.length;points.push([0,0,-1]);
 const face=(a,b,c)=>{i.push(a);j.push(b);k.push(c)};
 for(let s=0;s<sectors;s++){
  const next=(s+1)%sectors;face(0,1+s,1+next);
  for(let r=0;r<rings-2;r++){const a=1+r*sectors+s,b=1+r*sectors+next;face(a,a+sectors,b);face(b,a+sectors,b+sectors)}
  face(bottom,1+(rings-2)*sectors+next,1+(rings-2)*sectors+s);
 }
 return {points,i,j,k};
})();
function sphereMaterial(s){return {ambient:s.ambient/100,diffuse:.35,specular:s.highlights/100,roughness:.6,fresnel:0}}

function vertexSphereMesh(center,radius,settings){
 const {points,i,j,k}=graphSphereMesh;
 const axis=d=>points.map(p=>center[d]+radius*p[d]);
 return {type:'mesh3d',x:axis(0),y:axis(1),z:axis(2),i,j,k,flatshading:false,
  lighting:sphereMaterial(settings),lightposition:{x:100000,y:200000,z:300000}};
}
