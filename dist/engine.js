/* Pure game rules; no browser APIs, services, or third-party dependencies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ArchiveEngine = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const FLAGS = ['deskOpen', 'cabinetOpen', 'paintingRevealed', 'safeOpen', 'fuseInstalled', 'powerOn', 'escaped'];
  const NOTES = {
    clock: { title: '钟背的校时标签', text: '最后一次校时在凌晨三点一刻。抽屉以校时时刻为准：先时后分，四位归一。', source: '旧挂钟' },
    books: { title: '打乱的档案', text: '书脊上的年份与册号：1991 年 · 第 4 册；1976 年 · 第 7 册；2006 年 · 第 9 册；1983 年 · 第 1 册。', source: '档案书柜' },
    painting: { title: '紫光下的星图', text: '星图右下角浮现出四个符号，从左到右：星、月、日、月。旁边画着保险柜的轮廓。', source: '褪色星图' },
    circuit: { title: '电工留下的便条', text: '上路断开，中路与下路闭合。装好保险丝后，按下送电按钮。', source: '保险柜里的便条' },
    order: { title: '第七份档案', text: '“让档案从最早的一年走向最晚的一年，只取册号。那就是离开的密码。请让这些名字再次被看见。”', source: '保险柜里的信' }
  };
  const ITEMS = {
    key: {name:'黄铜钥匙',description:'抽屉里找到的小钥匙。钥匙柄上刻着一本书。',icon:'key'},
    uv: {name:'紫外线手电',description:'书柜里找到的手电。能显出某些纸张上看不见的字迹。',icon:'flashlight'},
    fuse: {name:'陶瓷保险丝',description:'保险柜里保存完好的保险丝，适合旧式配电箱。',icon:'zap'}
  };
  function initialState() {
    return {version:VERSION, started:false, playSeconds:0, flags:Object.fromEntries(FLAGS.map(f=>[f,false])), clues:[], hints:{}};
  }
  function hydrate(raw) {
    if (!raw || typeof raw !== 'object' || raw.version !== VERSION || !raw.flags || !Array.isArray(raw.clues) || !FLAGS.every(f => typeof raw.flags[f] === 'boolean')) return initialState();
    const s = initialState();
    for (const f of FLAGS) s.flags[f] = raw.flags[f];
    // Refuse impossible or partial saves; the normal gameplay never creates them.
    if ((s.flags.cabinetOpen && !s.flags.deskOpen) || (s.flags.paintingRevealed && !s.flags.cabinetOpen) || (s.flags.safeOpen && !s.flags.paintingRevealed) || (s.flags.fuseInstalled && !s.flags.safeOpen) || (s.flags.powerOn && !s.flags.fuseInstalled) || (s.flags.escaped && !s.flags.powerOn)) return initialState();
    s.started = Boolean(raw.started) || FLAGS.some(f => s.flags[f]);
    s.playSeconds = Number.isFinite(raw.playSeconds) ? Math.max(0, Math.min(604800, Math.floor(raw.playSeconds))) : 0;
    s.clues = [...new Set(raw.clues.filter(c => Object.hasOwn(NOTES,c)))];
    if (s.flags.paintingRevealed && !s.clues.includes('painting')) s.clues.push('painting');
    if (s.flags.safeOpen) for (const c of ['circuit','order']) if (!s.clues.includes(c)) s.clues.push(c);
    if (raw.hints && typeof raw.hints === 'object') for (const key of ['desk','cabinet','painting','safe','fuse','power','door']) if (Number.isInteger(raw.hints[key]) && raw.hints[key] >= 1 && raw.hints[key] <= 3) s.hints[key] = raw.hints[key];
    return s;
  }
  function inventory(s) {
    return [s.flags.deskOpen ? {id:'key',used:s.flags.cabinetOpen} : null,s.flags.cabinetOpen ? {id:'uv',used:false} : null,s.flags.safeOpen ? {id:'fuse',used:s.flags.fuseInstalled} : null].filter(Boolean);
  }
  function hasItem(s,id) { return inventory(s).some(i=>i.id===id && !i.used); }
  function progress(s) { return ['deskOpen','cabinetOpen','safeOpen','powerOn','escaped'].filter(f=>s.flags[f]).length; }
  function hintStage(s) {
    if (!s.flags.deskOpen) return 'desk';
    if (!s.flags.cabinetOpen) return 'cabinet';
    if (!s.flags.paintingRevealed && !s.flags.safeOpen) return 'painting';
    if (!s.flags.safeOpen) return 'safe';
    if (!s.flags.fuseInstalled) return 'fuse';
    if (!s.flags.powerOn) return 'power';
    return 'door';
  }
  const HINTS = {
    desk:['房间里的时间停住了。检查出口旁的旧挂钟。','抽屉需要四位数字。把钟背标签的校时时刻按“小时、分钟”写下，不足两位补零。','时间是 3 点 15 分。抽屉密码为 0315。'],
    cabinet:['抽屉里的钥匙柄上，刻着一本书。','在随身物品中选中黄铜钥匙，再调查档案书柜。','选择黄铜钥匙后，点击书柜窗口里的“使用选中物品”。'],
    painting:['手电的光是紫色的。有些墨水只有在紫外线下才能看见。','那幅褪色星图可能藏着被擦去的记号。','选中紫外线手电，调查星图，然后使用手电。'],
    safe:['星图上的四个符号，对应保险柜上的四枚符号锁。','按照星图从左到右的顺序转动锁盘。','四枚锁盘依次设为：星、月、日、月。'],
    fuse:['配电箱的保险丝槽里，似乎少了一个零件。','在随身物品中选择陶瓷保险丝，再调查配电箱。','选中陶瓷保险丝后，在配电箱窗口点击“使用选中物品”。'],
    power:['保险柜里的电工便条，记着三条电路的状态。','电路顺序按面板从上到下。“闭合”表示通电。','上路保持断开，中路和下路闭合，再点击“接通电源”。'],
    door:['第七份档案提到了时间的顺序。书柜里有四本带年份的档案。','把 1976、1983、1991、2006 年的档案按时间排列，再依次取它们的册号。','出口密码是 7149。在门边的密码锁输入后，打开出口。']
  };
  function transition(state, action) {
    const s = JSON.parse(JSON.stringify(state));
    let message = '', success = false, newItem = null;
    const note = id => {if (!s.clues.includes(id)) s.clues.push(id);};
    const done = (flag, text, item) => {if(s.flags[flag]) {message='这里的机关已经解开。';return;} s.flags[flag]=true;success=true;message=text;newItem=item || null;};
    if (s.flags.escaped && action.type !== 'start') return {state:s,message:'你已经离开了档案室。',success:false,newItem:null};
    if (action.type === 'start') s.started = true;
    else if (action.type === 'inspect') {s.started=true;if(action.target==='clock')note('clock');if(action.target==='books')note('books');}
    else if (action.type === 'desk') {
      if (String(action.code).trim() === '0315') done('deskOpen','抽屉弹开了。你找到一把黄铜钥匙。','key');
      else message='锁芯没有转动。再看看钟背标签的校时时刻。';
    } else if (action.type === 'use') {
      if (!hasItem(s,action.item)) message='请先在随身物品中选中一件可用的道具。';
      else if (action.target==='books' && action.item==='key') done('cabinetOpen','柜门打开了，里面放着一支紫外线手电。','uv');
      else if (action.target==='painting' && action.item==='uv') {done('paintingRevealed','紫色光束掠过纸面，四个符号显现出来。');note('painting');}
      else if (action.target==='panel' && action.item==='fuse') done('fuseInstalled','保险丝装好了。现在可以调节三条电路。');
      else message='这件物品在这里派不上用场。试试房间里的其他地方。';
    } else if (action.type === 'safe') {
      if (!s.flags.paintingRevealed) message='符号锁的起始位置已经磨损。先读出星图上的隐藏定位标记。';
      else if (action.code === '星月日月') {done('safeOpen','沉重的柜门开了。你找到保险丝和第七份档案。','fuse');note('circuit');note('order');}
      else message='符号锁依然纹丝不动。四个符号的顺序很重要。';
    } else if (action.type === 'power') {
      if (!s.flags.fuseInstalled) message='保险丝槽还是空的，无法送电。';
      else if (Array.isArray(action.switches) && action.switches.length === 3 && action.switches[0]===false && action.switches[1]===true && action.switches[2]===true) done('powerOn','电流声响起。门边的密码锁亮了。');
      else message='电路没有接通。重新读一读电工留下的便条。';
    } else if (action.type === 'door') {
      if (!s.flags.powerOn) message='密码锁没有电。先修复配电箱。';
      else if (String(action.code).trim() === '7149') done('escaped','门开了。你带着第七份档案走进黎明。');
      else message='密码错误。按档案年份从早到晚，只取册号。';
    } else if (action.type === 'hint') {
      const stage=hintStage(s);s.hints[stage]=Math.min(3,(s.hints[stage]||0)+1);message=HINTS[stage][s.hints[stage]-1];
    }
    if (progress(s)>0) s.started=true;
    return {state:s,message,success,newItem};
  }
  return {VERSION,NOTES,ITEMS,HINTS,initialState,hydrate,inventory,hasItem,progress,hintStage,transition};
});
