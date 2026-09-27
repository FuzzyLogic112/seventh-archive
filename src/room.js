import * as THREE from 'three';
import { SoftwareRenderer } from './software-renderer.js';

const N = window.ArchiveNavigation;
let canvas = document.querySelector('#world');
const markerLayer = document.querySelector('#world-markers');
const emit = (name, detail) => window.dispatchEvent(new CustomEvent('archive:' + name, { detail }));
const clamp = THREE.MathUtils.clamp;
let renderer;
try {
  const context=canvas.getContext('webgl2',{antialias:true,powerPreference:'high-performance'});
  if(context)renderer=new THREE.WebGLRenderer({canvas,context,antialias:true,powerPreference:'high-performance'});
  else renderer=new SoftwareRenderer(canvas);
} catch (error) {
  const replacement=canvas.cloneNode();canvas.replaceWith(replacement);canvas=replacement;
  try {renderer=new SoftwareRenderer(canvas);}
  catch {
    document.querySelector('#loading-status').textContent='当前浏览器无法显示 3D 画面，请更新浏览器后重试。';
    document.querySelector('#webgl-fallback').hidden=false;
    throw error;
  }
}
if(renderer.isSoftwareRenderer)document.body.classList.add('software-3d');
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.45;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x121b1c);
scene.fog = new THREE.FogExp2(0x152020, 0.023);
const camera = new THREE.PerspectiveCamera(61, 1, 0.08, 45);
camera.position.set(4.8, 3.7, 4.8);
camera.lookAt(-1, 1, -1.5);

let seed = 47;
const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function texture(draw, w = 512, h = 512) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return t;
}
const wood = texture((c, w, h) => {
  c.fillStyle = '#66503a'; c.fillRect(0, 0, w, h);
  for (let row = 0; row < 8; row++) {
    c.fillStyle = row % 2 ? '#73573c' : '#624933'; c.fillRect(0, row * 64, w, 63);
    c.fillStyle = '#28221b'; c.fillRect(0, row * 64, w, 2);
    for (let i = 0; i < 45; i++) {
      c.strokeStyle = 'rgba(' + (i % 2 ? '20,10,5,.13' : '200,170,100,.09') + ')';
      const y = row * 64 + random() * 60;
      c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(150, y + random() * 5, 320, y - 4, w, y); c.stroke();
    }
    c.fillStyle = '#2a231c'; c.fillRect((row % 3) * 150 + 40, row * 64, 2, 64);
  }
});
wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(3, 3);
const wallpaper = texture((c,w,h) => {
  c.fillStyle = '#48504b'; c.fillRect(0,0,w,h);
  for(let x=0;x<w;x+=40) { c.fillStyle = '#4c554d'; c.fillRect(x,0,2,h); }
  for(let y=0;y<h;y+=54) for(let x=0;x<w;x+=40) {
    c.strokeStyle='#77806b'; c.globalAlpha=.18;
    c.beginPath();c.moveTo(x+20,y);c.quadraticCurveTo(x+33,y+18,x+20,y+32);c.quadraticCurveTo(x+7,y+18,x+20,y);c.stroke();
  }
  c.globalAlpha=1;
});
wallpaper.wrapS = wallpaper.wrapT = THREE.RepeatWrapping; wallpaper.repeat.set(3, 1);
const mat = (color, options = {}) => new THREE.MeshStandardMaterial({ color, roughness: .8, ...options });
const M = {
  wood: mat(0x453323), trim: mat(0x69503a), dark: mat(0x191b19),
  wall: mat(0xffffff, { map: wallpaper }), brass: mat(0xb79454, { metalness: .65, roughness: .32 }),
  paper: mat(0xc4b995), iron: mat(0x354340, { metalness: .55, roughness: .55 }),
  cloth: mat(0x51483a), glow: new THREE.MeshBasicMaterial({color:0xffd28b}),
  green: new THREE.MeshBasicMaterial({color:0x89c7a2}), glass: mat(0x385965, {emissive:0x1c343c,emissiveIntensity:.7})
};
const cubeGeometry = new THREE.BoxGeometry(1,1,1);
function box(w,h,d,x,y,z,material=M.wood,parent=scene) {
  const mesh = new THREE.Mesh(cubeGeometry, material);
  mesh.scale.set(w,h,d);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function cylinder(rt,rb,h,x,y,z,material=M.brass,parent=scene,sides=16) {
  const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,sides),material);
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function sphere(r,x,y,z,material,parent=scene) {
  const m=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),material);
  m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;
}
function group(x=0,y=0,z=0,rotation=0) {const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotation;scene.add(g);return g;}
function sign(text,w,h,x,y,z,parent=scene,color='#d1bd8b',background='#252b28') {
  const t=texture(c=>{c.fillStyle=background;c.fillRect(0,0,512,256);c.fillStyle=color;c.textAlign='center';c.font='40px Georgia';text.split('\n').forEach((s,i,a)=>c.fillText(s,256,128+(i-(a.length-1)/2)*62));},512,256);
  const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,roughness:.95}));
  p.position.set(x,y,z);parent.add(p);return p;
}

// Room envelope. Real geometry and colliders replace the former photo hotspots.
const floor=box(14,.16,11,0,-.1,0,mat(0xffffff,{map:wood}));
box(14,4.3,.2,0,2.1,-5.5,M.wall);
box(14,4.3,.2,0,2.1,5.5,M.wall);
box(.2,4.3,11,-7,2.1,0,M.wall);
box(.2,4.3,11,7,2.1,0,M.wall);
for(const z of [-5.35,5.35]) {
  box(14,.15,.12,0,.11,z,M.trim);box(14,.16,.12,0,1.24,z,M.trim);
  box(14,.16,.16,0,4.1,z,M.trim);
  for(let x=-6.5;x<7;x+=1.1) box(.06,1.1,.1,x,.65,z,M.trim);
  box(14,1.12,.07,0,.64,z,M.wood);
}
for(const x of [-6.85,6.85]) {
  box(.12,.16,11,x,1.24,0,M.trim);box(.12,.15,11,x,.1,0,M.trim);
  box(.07,1.12,11,x,.64,0,M.wood);
  for(let z=-5;z<5.5;z+=1.1)box(.1,1.1,.06,x,.65,z,M.trim);
}
scene.traverse(o=>{if(o.isMesh)o.userData.paintLayer=o===floor?-30:-20;});
const rugTex=texture(c=>{
  c.fillStyle='#443831';c.fillRect(0,0,512,512);c.strokeStyle='#9c8158';c.lineWidth=7;c.strokeRect(24,24,464,464);c.lineWidth=2;c.strokeRect(40,40,432,432);
  c.translate(256,256);c.rotate(Math.PI/4);c.fillStyle='#716048';c.fillRect(-86,-86,172,172);c.strokeStyle='#b09360';c.strokeRect(-68,-68,136,136);
});
const rug=box(6,.018,5.7,0,.002,.2,mat(0xffffff,{map:rugTex}));rug.userData.paintLayer=-25;

// Investigator's desk, drawers, lamp and scattered pages.
const desk=group();
box(3.25,.17,1.65,0,1.22,0,M.trim,desk);
for(const x of [-1.42,1.42])for(const z of [-.65,.65])box(.16,1.2,.16,x,.58,z,M.wood,desk);
box(3,.3,1.45,0,1.01,0,M.wood,desk);
const drawer=box(.96,.24,.2,-.85,1.0,.79,M.trim,desk);
const handle=box(.23,.04,.07,-.85,1.0,.915,M.brass,desk);
for(let i=0;i<5;i++){const p=box(.42,.005,.3,.2+random()*.55,1.322+i*.005,-.15+random()*.45,M.paper,desk);p.rotation.y=random()-.5;}
sign('THE SEVENTH\nARCHIVE',.43,.25,.2,1.34,.1,desk).rotation.x=-Math.PI/2;
const lamp=group(-1.12,1.3,-.4);
cylinder(.24,.29,.04,0,.03,0,M.brass,lamp);cylinder(.025,.025,.55,0,.3,0,M.brass,lamp);
const shade=cylinder(.14,.32,.24,0,.68,0,mat(0x416955,{metalness:.15,roughness:.4}),lamp);
sphere(.075,0,.57,0,M.glow,lamp);
const deskLight=new THREE.PointLight(0xffbf76,30,7,2);deskLight.position.set(-1.12,1.88,-.4);scene.add(deskLight);
const chair=group(0,0,-1.65);
box(.75,.14,.75,0,.58,0,M.cloth,chair);box(.75,.8,.13,0,1,-.3,M.wood,chair);
for(const x of [-.28,.28])for(const z of [-.28,.28])box(.07,.58,.07,x,.28,z,M.wood,chair);

// Long, floor-standing archive cabinet against the east wall.
const cabinet=group(6.05,0,-2.1,-Math.PI/2);
box(4.4,3.25,.11,0,1.63,-.43,M.wood,cabinet);
for(const x of [-2.2,0,2.2])box(.13,3.35,1.05,x,1.68,0,M.trim,cabinet);
for(const y of [.12,.84,1.56,2.28,3.3])box(4.5,.11,1.05,0,y,0,M.trim,cabinet);
const bookMats=[0x5f4d3e,0x273d3a,0x5c352d,0x6e644a,0x313747].map(c=>mat(c));
for(let row=1;row<4;row++)for(let i=0;i<16;i++){
  const w=.13+random()*.06, h=.42+random()*.16, x=-1.98+i*.256;
  const b=box(w,h,.49,x,.91+(row-1)*.72+h/2,.08,bookMats[i%5],cabinet);
  if(i%5===0)b.rotation.z=(random()-.5)*.13;
  box(w*.8,.018,.015,x,.96+(row-1)*.72+h*.65,.335,M.brass,cabinet);
}
const cabinetDoors=[];
for(const x of [-1.08,1.08]){const hinge=new THREE.Group();hinge.position.set(x-.98,.18,.54);cabinet.add(hinge);box(1.96,.57,.08,.98,.29,0,M.wood,hinge);sphere(.05,1.53,.3,.07,M.brass,hinge);cabinetDoors.push(hinge);}
sign('1976     1983     1991     2006',3.6,.16,0,3.08,.55,cabinet);
const cabinetGlow=new THREE.PointLight(0x7568da,0,3);cabinetGlow.position.set(5.35,.65,-2.1);scene.add(cabinetGlow);

// Mechanical safe and framed star map.
const safe=group(-6.03,0,-3,Math.PI/2);
box(1.25,1.55,1.42,0,.86,0,M.iron,safe);
box(1.08,1.36,.03,0,.88,.725,M.dark,safe);
const safeHinge=new THREE.Group();safeHinge.position.set(-.61,.1,.77);safe.add(safeHinge);
box(1.2,1.48,.11,.6,.75,0,M.iron,safeHinge);
const safeDial=cylinder(.19,.19,.09,.79,.89,.1,M.brass,safeHinge);safeDial.rotation.x=Math.PI/2;
for(let i=0;i<4;i++)box(.11,.13,.04,.28+i*.19,1.18,.09,M.paper,safeHinge);
box(.12,.3,.08,.95,.54,.13,M.brass,safeHinge);
const sideboard=group(-6.13,0,1,Math.PI/2);
box(2.8,.9,.95,0,.48,0,M.wood,sideboard);box(2.95,.12,1.03,0,.98,0,M.trim,sideboard);
for(let i=0;i<3;i++){box(.86,.68,.06,-.94+i*.94,.5,.5,M.trim,sideboard);sphere(.04,-.94+i*.94,.5,.56,M.brass,sideboard);}
const painting=group(-6.79,2.55,1,Math.PI/2);
box(2.65,1.9,.1,0,0,0,M.brass,painting);box(2.51,1.77,.11,0,0,.025,M.dark,painting);
const starTex=texture(c=>{
  c.fillStyle='#172c30';c.fillRect(0,0,512,512);c.strokeStyle='#867d59';c.lineWidth=2;
  for(const r of [68,128,188,233]){c.beginPath();c.arc(256,256,r,0,Math.PI*2);c.stroke();}
  for(let i=0;i<17;i++){const a=i/17*Math.PI*2;c.beginPath();c.moveTo(256+68*Math.cos(a),256+68*Math.sin(a));c.lineTo(256+233*Math.cos(a),256+233*Math.sin(a));c.stroke();}
  for(let i=0;i<65;i++){c.fillStyle=i%3?'#b0af8b':'#e1d9b7';c.beginPath();c.arc(30+random()*452,30+random()*452,i%4?1.5:3,0,7);c.fill();}
  c.textAlign='center';c.font='21px Georgia';c.fillText('CELESTIAL ARCHIVE',256,478);
});
const starMaterial=new THREE.MeshStandardMaterial({map:starTex,roughness:1,emissive:0x7156c1,emissiveIntensity:0});
const starPlane=new THREE.Mesh(new THREE.PlaneGeometry(2.45,1.7),starMaterial);starPlane.position.z=.09;painting.add(starPlane);
const hiddenSymbols=sign('✦   ☾   ☀   ☾',1.5,.26,0,-.5,.105,painting,'#d9bbff','#49345d');hiddenSymbols.visible=false;

// North wall: clock, sealed door, electric panel.
const clock=group(-2.2,2.8,-5.2);
const rim=cylinder(.44,.44,.13,0,0,0,M.wood,clock,40);rim.rotation.x=Math.PI/2;
const clockTex=texture(c=>{
  c.fillStyle='#c9be9c';c.fillRect(0,0,512,512);c.strokeStyle='#38352a';c.lineWidth=6;c.beginPath();c.arc(256,256,226,0,7);c.stroke();
  c.fillStyle='#38352a';c.font='34px Georgia';c.textAlign='center';c.textBaseline='middle';
  for(let i=1;i<=12;i++){let a=i/6*Math.PI;c.fillText(String(i),256+185*Math.sin(a),256-185*Math.cos(a));}
  c.lineCap='round';c.lineWidth=12;c.beginPath();c.moveTo(256,256);c.lineTo(370,263);c.stroke();c.lineWidth=7;c.beginPath();c.moveTo(256,256);c.lineTo(421,256);c.stroke();
});
const clockFace=new THREE.Mesh(new THREE.CircleGeometry(.38,40),new THREE.MeshStandardMaterial({map:clockTex}));clockFace.position.z=.08;clock.add(clockFace);
sign('03 : 15',.65,.18,0,-.62,.06,clock);
const doorFrame=group(.4,0,-5.19);
box(2.03,3.26,.15,0,1.63,0,M.brass,doorFrame);
box(1.86,3.14,.17,0,1.57,.03,M.dark,doorFrame);
const doorPivot=new THREE.Group();doorPivot.position.set(-.88,0,.14);doorFrame.add(doorPivot);
box(1.76,3.08,.13,.88,1.54,0,M.wood,doorPivot);
for(const y of [.75,2.08])box(1.42,1.04,.04,.88,y,.085,M.trim,doorPivot);
box(.08,.23,.1,1.56,1.28,.15,M.brass,doorPivot);
sign('ARCHIVE\n07',.63,.35,.88,2.45,.115,doorPivot);
const keypad=box(.25,.4,.13,1.23,1.52,.18,M.iron,doorFrame);
const keypadScreen=box(.18,.08,.015,1.23,1.61,.257,M.dark,doorFrame);
for(let row=0;row<3;row++)for(let col=0;col<3;col++)box(.035,.033,.015,1.17+col*.06,1.51-row*.052,.26,M.paper,doorFrame);
const dawn=new THREE.PointLight(0xffe2b6,0,12,2);dawn.position.set(.4,1.6,-4.8);scene.add(dawn);
const panel=group(3.1,1.65,-5.15);
box(.82,1.15,.25,0,0,0,M.iron,panel);
sign('DANGER · 220V',.65,.17,0,.38,.14,panel,'#d7bc7d','#41463e');
const switches=[];
for(let i=0;i<3;i++){box(.37,.15,.06,.08,.15-i*.24,.16,M.dark,panel);switches.push(box(.13,.07,.08,.03,.15-i*.24,.21,M.paper,panel));}
const fuseIndicator=box(.07,.6,.07,-.26,-.08,.18,M.dark,panel);

// Window, rainy glass, sofa, radio, crates and a motionless coat.
const windowGroup=group(-6.83,2.4,3.9,Math.PI/2);
box(1.8,2.25,.14,0,0,0,M.trim,windowGroup);
box(1.65,2.08,.08,0,0,.07,M.glass,windowGroup);
box(.065,2.1,.08,0,0,.16,M.trim,windowGroup);box(1.67,.065,.08,0,0,.16,M.trim,windowGroup);
const rainGeo=new THREE.BufferGeometry(),rainVerts=[];
for(let i=0;i<50;i++){let x=(random()-.5)*1.6,y=(random()-.5)*2;rainVerts.push(x,y,.18,x-.04,y-.13,.18);}
rainGeo.setAttribute('position',new THREE.Float32BufferAttribute(rainVerts,3));
windowGroup.add(new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:0x99c5d2,transparent:true,opacity:.26})));
const moon=new THREE.SpotLight(0x9cd4e1,75,14,Math.PI/3,.6,1.5);moon.position.set(-6.4,3.6,3.9);moon.target.position.set(-1,.1,0);scene.add(moon,moon.target);
const sofa=group(4.7,0,3.6,Math.PI);
box(2.1,.42,1.05,0,.48,0,M.cloth,sofa);box(2.1,.77,.18,0,.87,-.43,M.cloth,sofa);
for(const x of [-1,1])box(.17,.6,1.05,x,.66,0,M.wood,sofa);
for(let i=0;i<2;i++)box(.84,.13,.76,-.46+i*.92,.74,.03,mat(0x66594a),sofa);
const crates=group(-4.7,0,3.65);
box(1.45,.6,1.2,0,.3,0,M.wood,crates);box(1.3,.5,1.0,.03,.86,.01,M.trim,crates);
sign('MISSING\nRECORDS',.65,.3,0,.83,.52,crates);
const radio=group(4.9,1.0,3.6);
box(.65,.3,.22,0,.15,0,M.wood,radio);
sign('FM 07',.4,.11,-.08,.17,.12,radio);sphere(.055,.23,.14,.12,M.brass,radio);
const coatStand=group(5.4,0,1.25);
cylinder(.03,.04,2.25,0,1.12,0,M.wood,coatStand);
for(let i=0;i<3;i++){const b=box(.05,.05,.7,0,.1,0,M.wood,coatStand);b.rotation.y=i*Math.PI/3;}
box(.7,.9,.25,.03,1.42,0,mat(0x292d2a),coatStand);
sphere(.15,0,2.24,0,M.wood,coatStand);
const ceilingLight=new THREE.PointLight(0xffd397,35,13,2);ceilingLight.position.set(0,3.7,-1.6);scene.add(ceilingLight);
cylinder(.28,.4,.17,0,3.72,-1.6,M.glow);
scene.add(new THREE.HemisphereLight(0x96b4ad,0x504130,1.25));
const keyLight=new THREE.DirectionalLight(0xffd6a2,1.4);keyLight.position.set(-3,7,4);keyLight.castShadow=true;
keyLight.shadow.mapSize.set(1024,1024);Object.assign(keyLight.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.5,far:25});
keyLight.shadow.bias=-.0008;keyLight.shadow.normalBias=.035;scene.add(keyLight);

// Articulated, human-shaped investigator; all parts are original procedural meshes.
function makePerson(shadow=false) {
  const person=new THREE.Group(), body=new THREE.Group();person.add(body);
  const coat=mat(shadow?0x111817:0x776b54),skin=mat(shadow?0x111817:0xc2a487),hair=mat(0x29251f),pants=mat(0x343b38),shoes=mat(0x201e1a);
  const hips=box(.38,.18,.27,0,.85,0,coat,body);
  const torso=box(.46,.48,.29,0,1.15,0,coat,body);
  const hem=box(.54,.26,.36,0,.9,0,coat,body);
  box(.06,.56,.025,0,1.08,.159,M.dark,body);
  box(.4,.06,.32,0,.96,0,M.dark,body);
  for(const x of [-.08,.08])box(.065,.24,.035,x,1.25,.174,M.trim,body);
  cylinder(.07,.08,.15,0,1.46,0,skin,body);
  const head=sphere(.17,0,1.65,0,skin,body);head.scale.set(.91,1.15,.9);
  const hairCap=sphere(.172,0,1.79,-.015,hair,body);hairCap.scale.set(1,.74,1);
  box(.27,.15,.12,0,1.7,-.1,hair,body);
  if(!shadow){sphere(.026,-.058,1.66,.141,M.dark,body);sphere(.026,.058,1.66,.141,M.dark,body);box(.05,.055,.055,0,1.61,.16,skin,body);}
  const arms=[],legs=[];
  for(const s of [-1,1]){
    const a=new THREE.Group();a.position.set(s*.285,1.36,0);body.add(a);
    box(.15,.39,.18,0,-.17,0,coat,a);box(.13,.26,.14,0,-.46,.015,coat,a);sphere(.073,0,-.61,.02,skin,a);arms.push(a);
    const l=new THREE.Group();l.position.set(s*.12,.79,0);body.add(l);
    box(.17,.62,.19,0,-.3,0,pants,l);box(.19,.13,.31,0,-.7,.052,shoes,l);legs.push(l);
  }
  box(.23,.33,.15,-.16,1.1,-.2,M.wood,body);
  const torch=cylinder(.047,.055,.18,0,-.65,.05,M.dark,arms[1]);torch.rotation.x=Math.PI/2;
  sphere(.045,0,-.65,.15,M.glow,arms[1]);
  return { root:person,body,arms,legs };
}
const player=makePerson();scene.add(player.root);player.root.rotation.y=Math.PI;
const apparition=makePerson(true);apparition.root.position.set(4.9,0,-.2);apparition.root.rotation.y=-Math.PI/2;apparition.root.visible=false;scene.add(apparition.root);
const flashlight=new THREE.SpotLight(0xffedc6,19,8,.5,.65,1.5);scene.add(flashlight,flashlight.target);
let flashlightOn=true;
const dustData=[];
for(let i=0;i<130;i++)dustData.push((random()-.5)*13,.2+random()*3.7,(random()-.5)*10);
const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.Float32BufferAttribute(dustData,3));
const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0xb5ac91,size:.022,transparent:true,opacity:.35,depthWrite:false}));scene.add(dust);

// Live interaction markers are projected from world coordinates, not painted onto an image.
const markerElements=new Map();
for(const t of N.TARGETS){
  const el=document.createElement('button');el.className='world-marker';el.dataset.target=t.id;el.type='button';
  el.setAttribute('aria-label','靠近调查'+t.label);el.innerHTML='<span class="marker-dot"></span><span class="marker-label">'+t.label+'</span>';
  el.hidden=true;markerLayer.appendChild(el);markerElements.set(t.id,el);
}
let position={...N.SPAWN},yaw=0,pitch=0,zoom=3.9,active=false,paused=true,nearest=null,flags={};
let horror=true,quality='standard',clockTime=0,walkPhase=0,lastStep=0,hauntUntil=0,hauntKind='',nextAmbient=25,frameNumber=0;
let deferredHaunt=null,markerMode=true;
const keys=new Set();
let joystick={x:0,z:0},heldPad={x:0,z:0},drag=null;
const temp=new THREE.Vector3(),idealCamera=new THREE.Vector3(),lookAt=new THREE.Vector3(),forward=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
const setPose=()=>{
  player.root.position.set(position.x,0,position.z);
  document.querySelector('#position-readout').textContent='X '+position.x.toFixed(1)+' / Z '+position.z.toFixed(1);
};
function clearInput(){keys.clear();joystick={x:0,z:0};heldPad={x:0,z:0};drag=null;document.querySelector('#joystick-stick').style.transform='translate(-50%, -50%)';}
function moveInput(x,z,amount){
  const d=N.direction(x,z,yaw),next=N.move(position,d.x*amount,d.z*amount);
  const distance=Math.hypot(next.x-position.x,next.z-position.z);
  position=next;
  if(distance>.001){player.root.rotation.y=Math.atan2(d.x,d.z);walkPhase+=distance*8;animateWalk(1);emit('move',{...position});}
  setPose();updateProximity();
  return distance;
}
function animateWalk(moving) {
  player.legs[0].rotation.x=Math.sin(walkPhase)*.52*moving;
  player.legs[1].rotation.x=-Math.sin(walkPhase)*.52*moving;
  player.arms[0].rotation.x=-Math.sin(walkPhase)*.4*moving;
  player.arms[1].rotation.x=-.28+Math.sin(walkPhase)*.22*moving;
  player.body.position.y=Math.abs(Math.sin(walkPhase))* .03*moving;
}
function updateProximity(){
  const target=N.nearby(position)[0]||null;
  if(target?.id!==nearest?.id){nearest=target;emit('nearby',target);}
}
function interact(id){
  if(!active||paused||flags.escaped)return;
  const t=N.nearby(position).find(t=>t.id===(id||nearest?.id));
  if(t)emit('interact',t.id);
  else emit('notice','先走到物件旁边，再进行调查。');
}
function haunt(kind){
  if(!horror||flags.escaped)return;
  if(paused){deferredHaunt=kind;return;}
  hauntKind=kind;hauntUntil=clockTime+(kind==='shadow'?3.5:2.7);
  emit('haunt',kind);
}
window.ArchiveWorld={
  ready:true,
  start(){active=true;paused=false;clearInput();updateProximity();},
  pause(value){paused=Boolean(value);clearInput();if(!paused&&deferredHaunt){const k=deferredHaunt;deferredHaunt=null;haunt(k);}},
  interact,
  canInteract(id){return active&&!flags.escaped&&N.nearby(position).some(t=>t.id===id);},
  reset(){position={...N.SPAWN};yaw=0;walkPhase=0;hauntUntil=0;deferredHaunt=null;apparition.root.visible=false;setPose();updateProximity();},
  restore(p){position=N.restorePosition(p);setPose();updateProximity();},
  getPosition(){return {...position};},
  setState(next){
    const old=flags;flags={...next};
    if(!old.deskOpen&&flags.deskOpen&&active)haunt('knock');
    if(!old.paintingRevealed&&flags.paintingRevealed&&active)haunt('shadow');
    if(!old.powerOn&&flags.powerOn&&active)haunt('power');
    if(flags.escaped){hauntUntil=0;apparition.root.visible=false;}
    hiddenSymbols.visible=Boolean(flags.paintingRevealed);
    starMaterial.emissiveIntensity=flags.paintingRevealed?.45:0;
    keypadScreen.material=flags.powerOn?M.green:M.dark;
    fuseIndicator.material=flags.fuseInstalled?M.paper:M.dark;
    switches.forEach((s,i)=>s.position.x=flags.powerOn&&i>0?.2:.03);
    cabinetGlow.intensity=flags.cabinetOpen?2:0;
  },
  setHorror(value){horror=Boolean(value);if(!horror){hauntUntil=0;deferredHaunt=null;apparition.root.visible=false;}document.body.classList.toggle('calm-mode',!horror);},
  setQuality(value){quality=value;renderer.setPixelRatio(Math.min(devicePixelRatio||1,value==='low'?1:1.6));renderer.shadowMap.enabled=value!=='low';if(renderer.isSoftwareRenderer)renderer.setQuality(value);},
  toggleFlashlight(){flashlightOn=!flashlightOn;return flashlightOn;},
  resetCamera(){yaw=0;pitch=0;zoom=3.9;},
  setMarkers(value){markerMode=Boolean(value);}
};
window.addEventListener('keydown',e=>{
  if(!active||paused||e.target.closest('input,textarea,select,dialog'))return;
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyQ','KeyR'].includes(e.code)){e.preventDefault();if(!e.repeat&&!keys.has(e.code)){
      const steps={KeyW:[0,-1],ArrowUp:[0,-1],KeyS:[0,1],ArrowDown:[0,1],KeyA:[-1,0],ArrowLeft:[-1,0],KeyD:[1,0],ArrowRight:[1,0]};
      const v=steps[e.code];if(v)moveInput(v[0],v[1],.12);
    }keys.add(e.code);}
  if(e.repeat)return;
  if(e.code==='KeyE'){e.preventDefault();interact();}
  if(e.code==='KeyF'){e.preventDefault();document.querySelector('#flashlight-button').click();}
  if(e.code==='KeyV'){e.preventDefault();window.ArchiveWorld.resetCamera();}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',clearInput);
canvas.addEventListener('pointerdown',e=>{if(!active||paused)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.id||paused)return;
  yaw-=(e.clientX-drag.x)*.006;pitch=clamp(pitch+(e.clientY-drag.y)*.006,-.45,.65);
  drag.x=e.clientX;drag.y=e.clientY;
});
const finishDrag=()=>{drag=null;};
canvas.addEventListener('pointerup',finishDrag);canvas.addEventListener('pointercancel',finishDrag);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{if(active&&!paused){e.preventDefault();zoom=clamp(zoom+e.deltaY*.003,2.2,5.4);}},{passive:false});
markerLayer.addEventListener('click',e=>{const button=e.target.closest('[data-target]');if(button)interact(button.dataset.target);});
const padVectors={forward:[0,-1],back:[0,1],left:[-1,0],right:[1,0]};
for(const button of document.querySelectorAll('[data-walk]')){
  let start=0,wasHeld=false;
  button.addEventListener('pointerdown',e=>{if(paused||!active)return;const [x,z]=padVectors[button.dataset.walk];heldPad={x,z};start=performance.now();wasHeld=true;button.setPointerCapture(e.pointerId);e.preventDefault();});
  const release=()=>{if(!wasHeld)return;const elapsed=performance.now()-start;heldPad={x:0,z:0};wasHeld=false;if(elapsed<180&&active&&!paused){const [x,z]=padVectors[button.dataset.walk];moveInput(x,z,.55);}};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',()=>{wasHeld=false;heldPad={x:0,z:0};});
  button.addEventListener('click',e=>{if(e.detail===0&&active&&!paused){const [x,z]=padVectors[button.dataset.walk];moveInput(x,z,.55);}});
}
const joy=document.querySelector('#joystick'),stick=document.querySelector('#joystick-stick');
let joyId=null;
function updateJoy(e){
  const rect=joy.getBoundingClientRect(),r=rect.width*.35;
  let x=(e.clientX-rect.left-rect.width/2)/r,z=(e.clientY-rect.top-rect.height/2)/r;
  const length=Math.max(1,Math.hypot(x,z));x/=length;z/=length;joystick={x,z};
  stick.style.transform='translate(calc(-50% + '+(x*r)+'px), calc(-50% + '+(z*r)+'px))';
}
joy.addEventListener('pointerdown',e=>{if(paused||!active)return;joyId=e.pointerId;joy.setPointerCapture(joyId);updateJoy(e);e.preventDefault();});
joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)updateJoy(e);});
const stopJoy=()=>{joyId=null;joystick={x:0,z:0};stick.style.transform='translate(-50%, -50%)';};
joy.addEventListener('pointerup',stopJoy);joy.addEventListener('pointercancel',stopJoy);
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;clearInput();emit('notice','3D 画面暂时中断，进度已保留。请刷新页面恢复。');});
canvas.addEventListener('webglcontextrestored',()=>location.reload());

function resize(){const rect=canvas.getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/Math.max(1,rect.height);camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(canvas);resize();
function projectMarkers(){
  for(const t of N.TARGETS){
    const el=markerElements.get(t.id),d=Math.hypot(position.x-t.x,position.z-t.z);
    temp.fromArray(t.marker).project(camera);
    const visible=active&&!paused&&markerMode&&!flags.escaped&&temp.z<1&&temp.z>-1&&Math.abs(temp.x)<.94&&Math.abs(temp.y)<.82&&d<6;
    el.hidden=!visible;
    if(visible){el.style.left=(temp.x*.5+.5)*100+'%';el.style.top=(-temp.y*.5+.5)*100+'%';el.classList.toggle('near',nearest?.id===t.id);el.classList.toggle('solved',Boolean(t.flag&&flags[t.flag]));}
  }
}
let previous=performance.now(),poseSave=0;
function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min((now-previous)/1000,.1);previous=now;
  if(document.hidden)return;
  if(!paused)clockTime+=dt;
  let moving=0;
  if(active&&!paused&&!flags.escaped){
    if(keys.has('KeyQ'))yaw+=dt*1.6;if(keys.has('KeyR'))yaw-=dt*1.6;
    const x=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+joystick.x+heldPad.x;
    const z=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0)+joystick.z+heldPad.z;
    if(Math.hypot(x,z)>.08){const distance=moveInput(x,z,dt*(keys.has('ShiftLeft')||keys.has('ShiftRight')?3.2:2));moving=distance>0?1:0;}
    if(moving&&clockTime-lastStep>.39){lastStep=clockTime;emit('footstep');}
    if(clockTime>nextAmbient){nextAmbient=clockTime+33+random()*19;haunt('knock');}
    if(clockTime-poseSave>2){poseSave=clockTime;emit('position',position);}
  }
  if(!moving){for(const limb of [...player.legs,...player.arms])limb.rotation.x*=.85;player.body.position.y=Math.sin(now*.0015)*.008;}
  if(active){
    lookAt.set(position.x-Math.sin(yaw)*.45,1.2,position.z-Math.cos(yaw)*.45);
    idealCamera.set(position.x+Math.sin(yaw)*zoom,2.8+pitch,position.z+Math.cos(yaw)*zoom);
    idealCamera.x=clamp(idealCamera.x,-6.55,6.55);idealCamera.z=clamp(idealCamera.z,-5.04,5.04);
    idealCamera.y=1.4+Math.hypot(idealCamera.x-position.x,idealCamera.z-position.z)*.36+pitch;
    // Keep the camera in the room, above low furnishings, and outside tall cabinets.
    for(const b of N.COLLIDERS.slice(2,5)){
      if(Math.abs(idealCamera.x-b.x)<b.w/2+.17&&Math.abs(idealCamera.z-b.z)<b.d/2+.15)idealCamera.x=b.x>0?b.x-b.w/2-.2:b.x+b.w/2+.2;
    }
    camera.position.lerp(idealCamera,1-Math.exp(-dt*9));camera.lookAt(lookAt);
    const baseFov=camera.aspect<.85?74:61;
    const desiredFov=Math.min(100,baseFov+Math.max(0,3.4-Math.hypot(camera.position.x-position.x,camera.position.z-position.z))*18);
    if(Math.abs(camera.fov-desiredFov)>.05){camera.fov=THREE.MathUtils.damp(camera.fov,desiredFov,6,dt);camera.updateProjectionMatrix();}
  }else{
    camera.position.x=4.8+Math.sin(now*.00008)*.12;camera.lookAt(-.6,1.1,-1.5);
  }
  forward.set(0,0,1).applyAxisAngle(up,player.root.rotation.y);
  flashlight.position.set(position.x+forward.x*.15,1.0,position.z+forward.z*.15);
  flashlight.target.position.set(position.x+forward.x*4,.65,position.z+forward.z*4);
  flashlight.intensity=flashlightOn&&active?19:0;
  const haunting=horror&&clockTime<hauntUntil&&!flags.escaped;
  const dim=haunting?(.45+.35*Math.sin((clockTime-hauntUntil)*4)) :1;
  // Slow dimming rather than rapid strobing; prefers-reduced-motion disables events in app.js.
  deskLight.intensity=30*dim;
  ceilingLight.intensity=(flags.powerOn?66:35)*dim;
  apparition.root.visible=haunting&&hauntKind==='shadow'&&!paused;
  document.body.classList.toggle('haunting',haunting&&!paused);
  for(const door of cabinetDoors)door.rotation.y=THREE.MathUtils.damp(door.rotation.y,flags.cabinetOpen?-1.05:0,4,dt);
  drawer.position.z=THREE.MathUtils.damp(drawer.position.z,flags.deskOpen?1.05:.79,5,dt);
  handle.position.z=drawer.position.z+.125;
  safeHinge.rotation.y=THREE.MathUtils.damp(safeHinge.rotation.y,flags.safeOpen?-1.65:0,5,dt);
  doorPivot.rotation.y=THREE.MathUtils.damp(doorPivot.rotation.y,flags.escaped?1.45:0,2,dt);
  dawn.intensity=THREE.MathUtils.damp(dawn.intensity,flags.escaped?110:0,1.5,dt);
  dust.rotation.y=Math.sin(now*.00004)*.025;
  if(++frameNumber%3===0)projectMarkers();
  renderer.render(scene,camera);
}
setPose();updateProximity();requestAnimationFrame(frame);
document.querySelector('#loading-status').textContent=renderer.isSoftwareRenderer?'档案室已就绪 · 兼容画质':'档案室已准备就绪';
document.querySelector('#start-button').disabled=false;
emit('ready');
