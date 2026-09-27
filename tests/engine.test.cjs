const {test} = require('node:test');
const assert = require('node:assert/strict');
const E = require('../dist/engine.js');

function routeToExit() {
  let s=E.initialState();
  const steps=[
    {type:'start'}, {type:'inspect',target:'clock'}, {type:'desk',code:'0315'},
    {type:'inspect',target:'books'}, {type:'use',target:'books',item:'key'},
    {type:'use',target:'painting',item:'uv'}, {type:'safe',code:'星月日月'},
    {type:'use',target:'panel',item:'fuse'}, {type:'power',switches:[false,true,true]}
  ];
  for(const action of steps)s=E.transition(s,action).state;
  return s;
}
test('A complete investigation reaches all five gates and every clue',()=>{
  const before=routeToExit();
  const result=E.transition(before,{type:'door',code:'7149'});
  assert.equal(result.success,true);assert.equal(E.progress(result.state),5);
  assert.equal(result.state.flags.escaped,true);
  assert.deepEqual(new Set(result.state.clues),new Set(Object.keys(E.NOTES)));
  assert.deepEqual(E.inventory(result.state).filter(i=>i.used).map(i=>i.id),['key','fuse']);
  assert.equal(before.flags.escaped,false,'Transition must not mutate its input');
});
test('Wrong codes, incorrect items and missing power never advance progress',()=>{
  let s=E.initialState();
  for(const action of [{type:'desk',code:'315'},{type:'desk',code:'0000'},{type:'use',target:'books',item:'key'},{type:'safe',code:'星月日月'},{type:'power',switches:[false,true,true]},{type:'door',code:'7149'}]) {
    const r=E.transition(s,action);assert.equal(r.success,false);assert.equal(E.progress(r.state),0);s=r.state;
  }
});
test('A wrong target does not consume a usable item',()=>{
  const s=E.transition(E.initialState(),{type:'desk',code:'0315'}).state;
  const wrong=E.transition(s,{type:'use',target:'painting',item:'key'});
  assert.equal(wrong.success,false);assert.equal(E.hasItem(wrong.state,'key'),true);
  assert.equal(E.transition(wrong.state,{type:'use',target:'books',item:'key'}).success,true);
});
test('Hints progress gradually, stop at three and stay scoped to each gate',()=>{
  let s=E.initialState();
  for(let i=0;i<6;i++)s=E.transition(s,{type:'hint'}).state;
  assert.equal(s.hints.desk,3);
  s=E.transition(s,{type:'desk',code:'0315'}).state;
  s=E.transition(s,{type:'hint'}).state;
  assert.equal(s.hints.cabinet,1);assert.equal(s.hints.desk,3);
});
test('A saved investigation resumes with all dependencies and hints intact',()=>{
  let s=routeToExit();s.playSeconds=523;s.hints={desk:2};
  const loaded=E.hydrate(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(loaded,s);assert.equal(E.transition(loaded,{type:'door',code:'7149'}).success,true);
});
test('Malformed, obsolete and impossible saves recover to a playable new game',()=>{
  for(const raw of [null,{},[],{version:99}, {...E.initialState(),flags:{...E.initialState().flags,escaped:true}}, {...E.initialState(),clues:'bad'}])assert.deepEqual(E.hydrate(raw),E.initialState());
  const raw={...E.initialState(),playSeconds:Infinity,clues:['clock','clock','<script>'],hints:{desk:100,door:1,unknown:3}};
  const s=E.hydrate(raw);assert.equal(s.playSeconds,0);assert.deepEqual(s.clues,['clock']);assert.deepEqual(s.hints,{door:1});
});
test('Repeated actions do not duplicate collectibles or notes',()=>{
  let s=routeToExit();const items=E.inventory(s);
  for(const action of [{type:'desk',code:'0315'},{type:'safe',code:'星月日月'},{type:'inspect',target:'books'}])s=E.transition(s,action).state;
  assert.deepEqual(E.inventory(s),items);assert.equal(s.clues.length,5);
});
test('Completed games freeze puzzle and hint state',()=>{
  const won=E.transition(routeToExit(),{type:'door',code:'7149'}).state;
  assert.deepEqual(E.transition(won,{type:'hint'}).state,won);
  assert.deepEqual(E.transition(won,{type:'use',target:'painting',item:'uv'}).state,won);
});
