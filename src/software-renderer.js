import { Color, Vector3 } from 'three';

/**
 * CPU depth-buffer renderer for devices without WebGL.
 * Uses the same 3D meshes, perspective camera and animation as the GPU renderer.
 * No browser flags, GPU permissions or security controls are changed.
 */
export class SoftwareRenderer {
  constructor(canvas) {
    this.domElement=canvas;this.ctx=canvas.getContext('2d',{alpha:false});
    if(!this.ctx)throw new Error('Neither WebGL nor Canvas 2D is available.');
    this.shadowMap={enabled:false,type:null};this.capabilities={getMaxAnisotropy:()=>1};
    this.width=1;this.height=1;this.ratio=1;this.maxWidth=860;this.lastFrame=-1;this.isSoftwareRenderer=true;
    this.toneMappingExposure=1.45;this.geoCache=new WeakMap();this.worldCache=new WeakMap();this.textureCache=new WeakMap();
    this.setSize(1,1);
  }
  setQuality(value){this.maxWidth=value==='low'?600:860;this.setSize(this.width,this.height);}
  setPixelRatio(r){this.ratio=Math.min(r,1);this.setSize(this.width,this.height);}
  setSize(w,h){
    this.width=Math.max(1,w);this.height=Math.max(1,h);
    const scale=Math.min(1,this.maxWidth/this.width);
    this.w=Math.max(1,Math.round(this.width*scale));this.h=Math.max(1,Math.round(this.height*scale));
    this.domElement.width=this.w;this.domElement.height=this.h;
    this.image=this.ctx.createImageData(this.w,this.h);this.pixels=new Uint32Array(this.image.data.buffer);this.depth=new Float32Array(this.w*this.h);
  }
  triangles(geometry){
    if(this.geoCache.has(geometry))return this.geoCache.get(geometry);
    const p=geometry.attributes.position,uv=geometry.attributes.uv,index=geometry.index,out=[];
    if(!p)return out;
    for(let i=0;i<(index?index.count:p.count);i+=3){
      const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
      out.push({v:ids.map(k=>new Vector3().fromBufferAttribute(p,k)),uv:uv?ids.map(k=>[uv.getX(k),uv.getY(k)]):[[0,0],[0,0],[0,0]]});
    }
    this.geoCache.set(geometry,out);return out;
  }
  worldFaces(mesh){
    const cached=this.worldCache.get(mesh);if(cached&&cached.matrix.equals(mesh.matrixWorld))return cached.faces;
    const faces=this.triangles(mesh.geometry).map(f=>{
      const v=f.v.map(p=>p.clone().applyMatrix4(mesh.matrixWorld));
      return {v,uv:f.uv,normal:new Vector3().crossVectors(v[1].clone().sub(v[0]),v[2].clone().sub(v[0])).normalize(),center:v[0].clone().add(v[1]).add(v[2]).multiplyScalar(1/3)};
    });
    this.worldCache.set(mesh,{matrix:mesh.matrixWorld.clone(),faces});return faces;
  }
  texture(map){
    if(this.textureCache.has(map))return this.textureCache.get(map);
    const image=map.image;if(!image?.width)return null;
    const c=document.createElement('canvas');c.width=image.width;c.height=image.height;
    const ctx=c.getContext('2d');ctx.drawImage(image,0,0);
    const result={pixels:new Uint32Array(ctx.getImageData(0,0,c.width,c.height).data.buffer),w:c.width,h:c.height,rx:map.repeat?.x||1,ry:map.repeat?.y||1};
    this.textureCache.set(map,result);return result;
  }
  clip(vertices,near){
    const result=[];
    for(let i=0;i<vertices.length;i++){
      const a=vertices[i],b=vertices[(i+1)%vertices.length],insideA=a.p.z<=-near,insideB=b.p.z<=-near;
      if(insideA)result.push(a);
      if(insideA!==insideB){const t=(-near-a.p.z)/(b.p.z-a.p.z);result.push({p:a.p.clone().lerp(b.p,t),u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t});}
    }
    return result;
  }
  raster(a,b,c,tex,base,shade,fog){
    const w=this.w,h=this.h,den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
    if(Math.abs(den)<.01)return;
    const minX=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),maxX=Math.min(w-1,Math.ceil(Math.max(a.x,b.x,c.x)));
    const minY=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),maxY=Math.min(h-1,Math.ceil(Math.max(a.y,b.y,c.y)));
    if(minX>maxX||minY>maxY)return;
    const ax=(b.y-c.y)/den,ay=(c.x-b.x)/den,bx=(c.y-a.y)/den,by=(a.x-c.x)/den;
    const inv0=a.inv,inv1=b.inv,inv2=c.inv;
    const u0=a.u*inv0,u1=b.u*inv1,u2=c.u*inv2,v0=a.v*inv0,v1=b.v*inv1,v2=c.v*inv2;
    const factor=shade*(1-fog),fr=17*fog,fg=35*fog,fb=28*fog;
    const pack=(r,g,b)=>0xff000000|Math.min(255,Math.max(0,Math.round(b*factor+fb)))<<16|Math.min(255,Math.max(0,Math.round(g*factor+fg)))<<8|Math.min(255,Math.max(0,Math.round(r*factor+fr)));
    const solid=pack(base[0],base[1],base[2]);
    for(let y=minY;y<=maxY;y++){
      let l0=ax*(minX+.5-c.x)+ay*(y+.5-c.y),l1=bx*(minX+.5-c.x)+by*(y+.5-c.y);
      for(let x=minX;x<=maxX;x++,l0+=ax,l1+=bx){
        const l2=1-l0-l1;if(l0<-.00001||l1<-.00001||l2<-.00001)continue;
        const inv=l0*inv0+l1*inv1+l2*inv2,index=y*w+x;
        if(inv<=this.depth[index])continue;
        this.depth[index]=inv;
        if(!tex){this.pixels[index]=solid;continue;}
        let u=(l0*u0+l1*u1+l2*u2)/inv*tex.rx,v=(l0*v0+l1*v1+l2*v2)/inv*tex.ry;
        u=u-Math.floor(u);v=v-Math.floor(v);
        const tx=Math.min(tex.w-1,Math.floor(u*tex.w)),ty=Math.min(tex.h-1,Math.floor((1-v)*tex.h));
        const pixel=tex.pixels[ty*tex.w+tx];
        this.pixels[index]=pack(pixel&255,(pixel>>>8)&255,(pixel>>>16)&255);
      }
    }
  }
  render(scene,camera){
    const now=performance.now();if(now-this.lastFrame<42)return;this.lastFrame=now;
    this.pixels.fill(0xff202b19);this.depth.fill(0);
    scene.updateMatrixWorld();camera.updateMatrixWorld();
    const lights=[],view=new Vector3();
    scene.traverseVisible(o=>{if(o.isPointLight||o.isSpotLight)lights.push({p:o.getWorldPosition(new Vector3()),power:o.intensity});});
    scene.traverseVisible(mesh=>{
      if(!mesh.isMesh||!mesh.geometry||Array.isArray(mesh.material))return;
      const m=mesh.material,col=(m.color||new Color('white')).clone().convertLinearToSRGB();
      const base=[col.r*255,col.g*255,col.b*255],tex=m.map?this.texture(m.map):null;
      for(const face of this.worldFaces(mesh)){
        view.subVectors(camera.position,face.center);
        const n=face.normal;if(n.dot(view)<=0&&m.side!==2)continue;
        let shade=.48+Math.max(0,n.x*-.3+n.y*.82+n.z*.4)*.36;
        for(const light of lights){
          const dx=light.p.x-face.center.x,dy=light.p.y-face.center.y,dz=light.p.z-face.center.z,dist=Math.hypot(dx,dy,dz);
          shade+=Math.max(0,(n.x*dx+n.y*dy+n.z*dz)/Math.max(.1,dist))*light.power/(dist*dist+2)*.028;
        }
        if(m.isMeshBasicMaterial)shade=1.12;
        shade=Math.min(1.5,shade*(this.toneMappingExposure/1.45));
        const fog=Math.min(.22,view.length()*.01);
        const raw=face.v.map((p,i)=>({p:p.clone().applyMatrix4(camera.matrixWorldInverse),u:face.uv[i][0],v:face.uv[i][1]}));
        const clipped=this.clip(raw,Math.max(.09,camera.near));if(clipped.length<3)continue;
        const points=clipped.map(p=>{const projected=p.p.clone().applyMatrix4(camera.projectionMatrix);return {x:(projected.x*.5+.5)*this.w,y:(-.5*projected.y+.5)*this.h,inv:1/-p.p.z,u:p.u,v:p.v};});
        for(let i=1;i<points.length-1;i++)this.raster(points[0],points[i],points[i+1],tex,base,shade,fog);
      }
    });
    this.ctx.putImageData(this.image,0,0);
  }
}
