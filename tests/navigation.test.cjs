const {test}=require('node:test');
const assert=require('node:assert/strict');
const N=require('../dist/navigation.js');
test('The spawn and every investigation approach are traversable',()=>{
  assert.ok(N.validPosition(N.SPAWN));
  for(const target of N.TARGETS)assert.ok(N.validPosition(target),target.id);
});
test('Long movement cannot tunnel through the desk or through room boundaries',()=>{
  const p=N.move({x:0,z:2},0,-8);
  assert.ok(p.z>=1.1,'The investigator must stop in front of the desk');
  const wall=N.move({x:3,z:0},100,0);
  assert.ok(wall.x<=N.BOUNDS.x-N.RADIUS);
  assert.ok(N.validPosition(wall));
});
test('Collision allows sliding along furniture without moving into it',()=>{
  const p=N.move({x:0,z:1.2},.7,-.7);
  assert.ok(p.x>.5);assert.ok(p.z>=1.1);assert.ok(N.validPosition(p));
});
test('Diagonal movement is normalized and rotates with the camera',()=>{
  const d=N.direction(1,-1);assert.ok(Math.abs(Math.hypot(d.x,d.z)-1)<1e-10);
  const q=N.direction(0,-1,Math.PI/2);assert.ok(q.x<-.999);assert.ok(Math.abs(q.z)<1e-10);
});
test('Distant objects are unavailable; objects next to the character can be inspected',()=>{
  assert.equal(N.nearby(N.SPAWN).length,0);
  for(const t of N.TARGETS)assert.ok(N.nearby(t).some(r=>r.id===t.id),t.id);
});
test('Invalid, nonfinite, outside and furniture-intersecting saves recover to the entrance',()=>{
  for(const raw of [null,{}, {x:Infinity,z:0},{x:0,z:0},{x:10,z:0},{x:0,z:NaN}])assert.deepEqual(N.restorePosition(raw),N.SPAWN);
  assert.deepEqual(N.restorePosition({x:3,z:2}),{x:3,z:2});
});
test('Every clue and exit can be reached from the entrance around the furniture',()=>{
  const step=.25,start={x:0,z:3.75},queue=[start],visited=new Set(['0,3.75']);
  const reached=new Set();
  for(let i=0;i<queue.length;i++){
    const p=queue[i];for(const t of N.nearby(p))reached.add(t.id);
    for(const [dx,dz] of [[step,0],[-step,0],[0,step],[0,-step]]){
      const n={x:p.x+dx,z:p.z+dz},key=n.x+','+n.z;
      if(!visited.has(key)&&N.validPosition(n)){visited.add(key);queue.push(n);}
    }
  }
  assert.deepEqual([...reached].sort(),N.TARGETS.map(t=>t.id).sort());
});
