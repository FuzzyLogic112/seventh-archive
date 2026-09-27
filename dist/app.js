(function () {
  'use strict';
  const E = window.ArchiveEngine;
  const $ = s => document.querySelector(s);
  const STORAGE_KEY = 'seventh-archive-save-v1';
  let storageOK = true;
  let state;
  try {state = E.hydrate(JSON.parse(localStorage.getItem(STORAGE_KEY)));} catch {state = E.initialState();storageOK=false;}
  let selectedItem = null, activeTarget = null, toastTimeout, sound = null, soundEnabled = false;
  const paths = {
    sound:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    muted:'<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/>',
    help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.8-2.5 1.7-2.5 3.5m0 3h.01"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    key:'<circle cx="8" cy="8" r="4"/><path d="m11 11 10 10m-6-6 3-3m0 6 3-3"/>',
    flashlight:'<path d="m9 3-5 5 5 5 5-5-5-5Zm1 9 8 9 3-3-9-8m4-7 2-2m0 6 3-1m-9-4 1-3"/>',
    zap:'<path d="M13 2 4 14h7l-1 8 10-12h-7l1-8Z"/>',
    check:'<path d="m5 12 4 4L19 6"/>'
  };
  const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true">'+(paths[name] || paths.help)+'</svg>';
  const escapeText = value => String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const targets = window.ArchiveNavigation.TARGETS;
  const world = window.ArchiveWorld;
  const SETTINGS_KEY='seventh-archive-settings-v2', POSITION_KEY='seventh-archive-position-v2';
  let playing=false, settings={horror:!matchMedia('(prefers-reduced-motion: reduce)').matches,quality:'standard',markers:true};
  try {
    const raw=JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if(raw){if(typeof raw.horror==='boolean')settings.horror=raw.horror;if(raw.quality==='low')settings.quality='low';if(typeof raw.markers==='boolean')settings.markers=raw.markers;}
    if(state.started)world?.restore(JSON.parse(localStorage.getItem(POSITION_KEY)));
  } catch {}
  world?.setHorror(settings.horror);world?.setQuality(settings.quality);world?.setMarkers(settings.markers);
  $('#intro-horror').checked=settings.horror;
  $('#start-button').innerHTML=state.started?'继续调查 <span>↗</span>':'进入档案室 <span>↗</span>';
  if(!world)$('#start-button').disabled=true;
  const objectives = {desk:'从房间里的时间，寻找第一条线索。',cabinet:'黄铜钥匙上的图案，指向哪里？',painting:'有些文字，需要另一种光才能读懂。',safe:'星图上的符号，似乎是一组顺序。',fuse:'找到缺失的零件，让房间恢复供电。',power:'按电工便条，接通正确的电路。',door:'让档案回到时间的顺序，出口就在眼前。'};
  $('#sound-button').innerHTML=icon('muted');$('#help-button').innerHTML=icon('help');$('#close-dialog').innerHTML=icon('close');
  $('#flashlight-button').innerHTML=icon('flashlight');
  $('#map-markers').innerHTML=targets.map(t=>'<circle cx="'+(70+t.x*9.2)+'" cy="'+(55+t.z*9.2)+'" r="1.8"/>').join('');
  function updateMap(p) {$('#map-player').setAttribute('transform','translate('+(70+p.x*9.2)+' '+(55+p.z*9.2)+')');}
  if(world)updateMap(world.getPosition());
  function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));}catch{}}
  function savePosition(){try{if(world)localStorage.setItem(POSITION_KEY,JSON.stringify(world.getPosition()));}catch{}}
  function formatTime(seconds) {return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
  function hintCount() {return Object.values(state.hints).reduce((a,b)=>a+b,0);}
  function save() {
    try {localStorage.setItem(STORAGE_KEY,JSON.stringify(state));storageOK=true;} catch {storageOK=false;}
    $('#save-status').textContent = storageOK ? '进度已保存' : '无法保存';
  }
  function toast(message) {if(!message)return;clearTimeout(toastTimeout);$('#toast').textContent=message;$('#toast').hidden=false;toastTimeout=setTimeout(()=>$('#toast').hidden=true,3800);}
  function renderTimer() {$('#timer').textContent=formatTime(state.playSeconds);$('#timer').setAttribute('aria-label',`探索用时 ${Math.floor(state.playSeconds/60)} 分 ${state.playSeconds%60} 秒`);}
  function render() {
    const done=E.progress(state),items=E.inventory(state);
    if(selectedItem&&!E.hasItem(state,selectedItem))selectedItem=null;
    $('#progress-number').textContent=done;
    $('#progress-segments').innerHTML=Array.from({length:5},(_,i)=>`<span class="${i<done?'complete':''}"></span>`).join('');
    $('#progress-segments').setAttribute('aria-valuenow',done);
    $('#objective').textContent=state.flags.escaped?'五道机关全部解开。你找回了被封存的真相。':state.started?objectives[E.hintStage(state)]:'每一件旧物，都有未说完的话。';
    $('#clue-count').textContent=state.clues.length;
    $('#inventory-count').textContent=items.length+' / 3';
    $('#inventory-instruction').textContent=selectedItem?'已选中'+E.ITEMS[selectedItem].name+'，现在去调查它可能派上用场的地方。':items.length?'点击物品选中，再到场景中使用。':'找到的物品，会收在这里。';
    $('#inventory').innerHTML=Array.from({length:3},(_,i)=>{
      const item=items[i];if(!item)return `<div class="inventory-slot empty" aria-label="空物品栏 ${i+1}"><span class="slot-number">0${i+1}</span></div>`;
      const data=E.ITEMS[item.id];return `<button class="inventory-slot ${selectedItem===item.id?'selected':''} ${item.used?'used':''}" data-item="${item.id}" aria-pressed="${selectedItem===item.id}" aria-label="${data.name}${item.used?'，已使用':''}" ${item.used?'disabled':''}>${icon(data.icon)}<span><span class="item-name">${data.name}</span><span class="item-state">${item.used?'已使用':selectedItem===item.id?'已选中 · 点击取消':'点击选择'}</span></span></button>`;
    }).join('');
    world?.setState(state.flags);
    $('#escape-overlay').hidden=!state.flags.escaped;
    $('#hint-count').textContent=hintCount();$('#hint-button').disabled=state.flags.escaped;
    $('#scene-guidance').textContent=selectedItem?'已携带 '+E.ITEMS[selectedItem].name:'慢一点。听听这间房间。';
    renderTimer();save();
  }
  function noteHTML(id,full) {const n=E.NOTES[id];return `<article class="${full?'clue-card':'note-entry'}"><h3>${n.title}</h3><p>${n.text}</p><p class="${full?'clue-caption':'note-source'}">${n.source}</p></article>`;}
  function dispatch(action,announce=true) {const r=E.transition(state,action);state=r.state;render();if(announce&&r.message)toast(r.message);if(r.success)playChime();return r;}
  const dialog=$('#inspect-dialog');
  function openDialog(title,body,kicker='调查物件') {
    $('#dialog-kicker').textContent=kicker;
    $('#dialog-content').innerHTML=`<h2 class="dialog-title" id="dialog-title" tabindex="-1">${title}</h2>`+body;
    world?.pause(true);
    if(!dialog.open)dialog.showModal();
    const focusTarget=$('#dialog-content input:not([type="checkbox"])')||$('#dialog-title');focusTarget.focus({preventScroll:true});
  }
  function success(text) {return `<p class="success-line">${icon('check')}${text}</p>`;}
  function itemPreview(id,text) {const item=E.ITEMS[id];return `<div class="item-preview">${icon(item.icon)}<div><h3>${item.name}</h3><p>${text||item.description}</p></div></div>`;}
  function inputForm(type,label,button) {return `<form class="puzzle-form" data-puzzle="${type}"><label class="form-label" for="code-input">${label}</label><input class="code-input" id="code-input" name="code" inputmode="numeric" autocomplete="off" pattern="[0-9]{4}" maxlength="4" minlength="4" placeholder="· · · ·" aria-describedby="puzzle-feedback" aria-label="${label}" required><button class="primary-button" type="submit">${button}</button><p class="puzzle-feedback" id="puzzle-feedback" role="status" aria-live="polite"></p></form>`;}
  function useButton() {return `<p class="form-label">${selectedItem?'当前选中：'+E.ITEMS[selectedItem].name:'先关闭窗口，在随身物品中选择道具。'}</p><button class="primary-button" data-action="use" ${!selectedItem?'disabled':''}>使用选中物品 <span aria-hidden="true">↗</span></button><p class="puzzle-feedback" id="puzzle-feedback" role="status" aria-live="polite"></p>`;}
  function inspect(target) {
    if(!targets.some(t=>t.id===target))return;
    if(!world?.canInteract(target)){toast('需要先控制人物走到物件旁边。');return;}
    if(state.flags.escaped){showResult();return;}
    activeTarget=target;dispatch({type:'inspect',target},false);renderInspect(target);
  }
  function renderInspect(target) {
    const f=state.flags;
    if(target==='clock')openDialog('停摆的挂钟','<p class="dialog-copy">秒针已经很久没有走动。你小心抹去木壳上的灰，在钟背发现了一张维修标签。</p><div class="clue-card"><p>“最后一次校时：凌晨三点一刻。<br>抽屉以校时时刻为准。<br>先时后分，四位归一。”</p><p class="clue-caption">这条线索已记入手记。</p></div>');
    if(target==='desk')openDialog('上锁的书桌抽屉',f.deskOpen?'<p class="dialog-copy">抽屉里只有一张旧合照，和放过钥匙的浅浅凹痕。照片背后写着：我们不该忘记任何人。</p>'+success('抽屉的密码锁已解开。'):'<p class="dialog-copy">抽屉被四位密码锁锁住。锁孔旁刻着一只小小的钟，下面还有一句话：“记住最后校时的时刻。”</p>'+inputForm('desk','四位数字密码','尝试打开抽屉'));
    if(target==='books') {
      const books='<div class="book-clues">'+[[1991,4],[1976,7],[2006,9],[1983,1]].map(([year,n])=>`<div class="book-card"><span>${year}</span><small>档案 · 第 ${n} 册</small></div>`).join('')+'</div>';
      openDialog('档案书柜','<p class="dialog-copy">四本带年份的档案散落在书架上。下方柜门的锁孔很小，锁边刻着一本书。</p>'+books+(f.cabinetOpen?success('下方柜门已打开，紫外线手电已收好。'):useButton()));
    }
    if(target==='painting')openDialog('褪色的星图','<p class="dialog-copy">年代久远的星图已经褪色。右下角一小块纸面却格外干净，像是曾被人仔细擦拭过。</p>'+(f.paintingRevealed?'<div class="revealed-symbols" aria-label="星、月、日、月">✦ ☾ ☀ ☾</div><div class="clue-card"><p>从左到右：星 · 月 · 日 · 月</p><p class="clue-caption">符号旁画着一只保险柜。这条线索已记入手记。</p></div>':useButton()));
    if(target==='safe')openDialog('沉默的保险柜',f.safeOpen?'<p class="dialog-copy">柜门已经敞开。你找到的第七份档案并不是什么宝藏，只是一册不该被遗忘的名字。</p>'+noteHTML('circuit',true)+noteHTML('order',true):'<p class="dialog-copy">四枚锁盘上刻着日、月、星。每一个位置都可以转动，也许房间里藏着它们的正确顺序。</p><form class="puzzle-form" data-puzzle="safe"><div class="symbol-row">'+Array.from({length:4},(_,i)=>`<div class="symbol-control"><label for="symbol-${i}">第 ${i+1} 位</label><select id="symbol-${i}" name="symbol-${i}" aria-label="第 ${i+1} 位符号"><option value="日">☀ 日</option><option value="月">☾ 月</option><option value="星">✦ 星</option></select></div>`).join('')+'</div><button class="primary-button" type="submit">转动把手</button><p class="puzzle-feedback" id="puzzle-feedback" role="status" aria-live="polite"></p></form>');
    if(target==='panel') {
      let body='<p class="dialog-copy">金属面板后是三条老式电路。上、中、下三个开关控制着门边密码锁的电源。</p>';
      if(f.powerOn)body+=success('电路已接通。出口密码锁正在等待输入。');
      else if(!f.fuseInstalled)body+='<div class="fuse-state">保险丝槽：空</div>'+useButton();
      else body+='<div class="fuse-state">保险丝已安装</div><form class="puzzle-form" data-puzzle="power"><div class="switch-list">'+['上路','中路','下路'].map((label,i)=>`<label class="switch-row" for="switch-${i}"><span>${label}</span><span class="switch-state">断开</span><input type="checkbox" id="switch-${i}" name="switch-${i}" aria-label="${label}闭合"></label>`).join('')+'</div><button class="primary-button" type="submit">接通电源</button><p class="puzzle-feedback" id="puzzle-feedback" role="status" aria-live="polite"></p></form>';
      openDialog('老式配电箱',body);
    }
    if(target==='door')openDialog('最后一道门',f.powerOn?'<p class="dialog-copy">屏幕亮着微弱的绿光。门上的铭牌写着：“时间会让一切回到应有的位置。”</p>'+inputForm('door','出口的四位数字密码','打开出口'):'<p class="dialog-copy">你试着拉动门把手，纹丝不动。门边是一块四位数字密码锁，但屏幕没有亮。</p><div class="clue-card"><p>密码锁没有电。需要先找到房间里的供电装置。</p></div>');
  }
  function showJournal() {activeTarget=null;openDialog('调查手记',state.clues.length?state.clues.map(id=>noteHTML(id,true)).join(''):'<p class="dialog-copy">还没有发现线索。调查房间里的物件，重要内容会自动记在这里。</p>','FIELD NOTES / 自动记录');}
  function showHint(increment) {
    if(state.flags.escaped)return;
    if(!state.started)dispatch({type:'start'},false);
    const stage=E.hintStage(state);
    if(increment||!state.hints[stage])dispatch({type:'hint'},false);
    const level=state.hints[stage]||1;
    activeTarget=null;
    openDialog('一点方向','<div class="hint-page">提示 '+level+' / 3</div><div class="clue-card"><p>'+E.HINTS[stage][level-1]+'</p></div><button class="secondary-button" style="width:100%" data-action="next-hint" '+(level>=3?'disabled':'')+'>'+(level>=3?'本机关的提示已全部展开':'再给我一点提示')+' <span aria-hidden="true">↗</span></button><p class="hint-disclaimer">每次展开新提示会记入逃脱记录。重复查看不计数。</p>','A GENTLE NUDGE');
  }
  function showResult() {activeTarget=null;openDialog('你带回了黎明。','<p class="dialog-copy">门开时，雨恰好停了。你把第七份档案抱在怀里。名单上的每一个名字，终于不再只属于这间房间。</p><div class="result-stats"><div class="result-stat"><strong>'+formatTime(state.playSeconds)+'</strong><span>探索用时</span></div><div class="result-stat"><strong>'+hintCount()+'</strong><span>展开提示</span></div></div><div class="clue-card"><p>'+(hintCount()===0?'不借一束光，也能找到出口。<br>获得记录：独立调查员。':'每一步观察，都让真相更近一点。<br>获得记录：档案守护者。')+'</p></div><div class="dialog-actions"><button class="secondary-button" data-action="journal">回顾手记</button><button class="primary-button" data-action="restart">再探一次</button></div>','CASE CLOSED / 成功逃脱');}
  function confirmRestart() {activeTarget=null;openDialog('重新进入档案室？','<p class="dialog-copy">本次进度、线索、用时和提示记录会清空。这间房间将重新回到午夜。</p><div class="dialog-actions"><button class="secondary-button" data-action="cancel">继续本次探索</button><button class="primary-button" data-action="reset-confirm">重新开始</button></div>','NEW INVESTIGATION');}
  function showHelp() {activeTarget=null;openDialog('先走近，再发现','<ol class="help-list"><li>用 WASD / 方向键移动人物，Shift 快走。也可以按住左下角的方向按钮。</li><li>在画面空白处拖动鼠标转动视角；Q / R 转向，V 重置视角，滚轮拉近或拉远。</li><li>走近物件，按 E 或点击“调查”按钮。必须站在物件旁边才能互动。</li><li>找到道具后，点击下方物品栏选中；走到对应位置，调查并使用。</li><li>F 开关手电筒；J 打开手记；Esc 关闭窗口。重要线索自动记录。</li><li>手机：左下角摇杆走动，在画面右侧拖动转向，点调查按钮互动。</li></ol><p class="dialog-copy">轻度恐怖包含敲门声、灯光渐暗和短暂人影。没有追杀、血腥画面或失败倒计时；可以在设置中随时关闭恐怖效果。声音默认关闭。</p>','FIELD MANUAL / 操作说明');}
  function showSettings() {
    activeTarget=null;
    openDialog('让黑夜适合你',
      '<div class="setting-row"><span>恐怖氛围<small>灯光渐暗、敲门声与短暂人影</small></span><button data-action="horror" aria-pressed="'+settings.horror+'">'+(settings.horror?'已开启':'已关闭')+'</button></div>'+
      '<div class="setting-row"><span>画面质量<small>若画面卡顿，可选择流畅模式</small></span><select id="quality-select" aria-label="画面质量"><option value="standard" '+(settings.quality==='standard'?'selected':'')+'>标准 · 动态阴影</option><option value="low" '+(settings.quality==='low'?'selected':'')+'>流畅 · 较低分辨率</option></select></div>'+
      '<div class="setting-row"><span>调查标记<small>关闭后也可通过靠近提示进行调查</small></span><button data-action="markers" aria-pressed="'+settings.markers+'">'+(settings.markers?'显示':'隐藏')+'</button></div>'+
      '<div class="setting-row"><span>角色位置<small>回到入口，保留全部线索和道具</small></span><button data-action="reposition">回到入口</button></div>'+
      '<div class="setting-row"><span>重新开始<small>清空这次调查进度</small></span><button data-action="restart">新调查</button></div>','PREFERENCES / 游戏设置');
  }
  async function toggleSound() {
    try {
      if(!sound) {
        const AC=window.AudioContext||window.webkitAudioContext;if(!AC){toast('当前浏览器不支持环境音。');return;}
        const ctx=new AC();const gain=ctx.createGain();gain.gain.value=0;gain.connect(ctx.destination);
        const buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);const data=buffer.getChannelData(0);let last=0;
        for(let i=0;i<data.length;i++){last=(last+.018*(Math.random()*2-1))/1.018;data[i]=last*4;}
        const rain=ctx.createBufferSource();rain.buffer=buffer;rain.loop=true;
        const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1400;rain.connect(filter);filter.connect(gain);rain.start();const master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);sound={ctx,gain,master};
      }
      if(sound.ctx.state==='suspended')await sound.ctx.resume();soundEnabled=!soundEnabled;
      sound.gain.gain.setTargetAtTime(soundEnabled?.18:0,sound.ctx.currentTime,.25);
      sound.master.gain.setTargetAtTime(soundEnabled?1:0,sound.ctx.currentTime,.15);
      $('#sound-button').innerHTML=icon(soundEnabled?'sound':'muted');$('#sound-button').setAttribute('aria-pressed',soundEnabled);$('#sound-button').setAttribute('aria-label',soundEnabled?'关闭环境音':'开启环境音');
      toast(soundEnabled?'雨声已开启。':'环境音已关闭。');
    } catch {toast('暂时无法播放环境音，游戏可以继续。');}
  }
  function playChime() {if(!soundEnabled||!sound)return;try{const c=sound.ctx;const o=c.createOscillator();const g=c.createGain();o.type='sine';o.frequency.setValueAtTime(440,c.currentTime);o.frequency.exponentialRampToValueAtTime(660,c.currentTime+.16);g.gain.setValueAtTime(.03,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+.55);o.connect(g);g.connect(sound.master);o.start();o.stop(c.currentTime+.6);}catch{}}
  function effect(kind){
    if(!soundEnabled||!sound)return;
    const c=sound.ctx;
    try{
      const times=kind==='knock'?[0,.42,.9]:[0];
      for(const delay of times){
        const o=c.createOscillator(),g=c.createGain(),t=c.currentTime+delay;
        o.type=kind==='shadow'?'sine':'triangle';o.frequency.setValueAtTime(kind==='step'?65:kind==='knock'?95:51,t);
        const volume=kind==='step'?.014:kind==='knock'?.025:.026;
        g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+(kind==='shadow'?1.8:.17));
        o.connect(g);g.connect(sound.master);o.start(t);o.stop(t+(kind==='shadow'?2:.2));
      }
    }catch{}
  }
  function refreshNearby(target){
    $('#interact-button').disabled=!target||state.flags.escaped;
    $('#nearby-label').textContent=target?target.label:'探索档案室';
    $('#nearby-copy').textContent=target?'按 E 或点此调查':'走近物件，即可调查';
  }
  window.addEventListener('archive:interact',e=>inspect(e.detail));
  window.addEventListener('archive:nearby',e=>refreshNearby(e.detail));
  window.addEventListener('archive:notice',e=>toast(e.detail));
  window.addEventListener('archive:move',e=>updateMap(e.detail));
  window.addEventListener('archive:position',savePosition);
  window.addEventListener('archive:footstep',()=>effect('step'));
  window.addEventListener('archive:haunt',e=>{effect(e.detail);toast(e.detail==='shadow'?'你确信刚才的书架旁，站着一个人。':e.detail==='power'?'灯亮了。走廊里的脚步声，也停了。':'三声轻轻的敲击，从锁住的门后传来。');});
  $('#interact-button').addEventListener('click',()=>world?.interact());
  $('#flashlight-button').addEventListener('click',()=>{const on=world?.toggleFlashlight();$('#flashlight-button').setAttribute('aria-pressed',Boolean(on));$('#flashlight-button').setAttribute('aria-label',on?'关闭手电筒':'开启手电筒');});
  $('#camera-reset').addEventListener('click',()=>world?.resetCamera());
  $('#settings-button').addEventListener('click',showSettings);
  document.addEventListener('keydown',e=>{if(e.code==='KeyJ'&&playing&&!dialog.open&&!e.repeat&&!e.target.closest('input,textarea,select')){e.preventDefault();showJournal();}});
  $('#inventory').addEventListener('click',e=>{const b=e.target.closest('[data-item]');if(!b||!E.hasItem(state,b.dataset.item))return;selectedItem=selectedItem===b.dataset.item?null:b.dataset.item;render();$(`#inventory [data-item="${b.dataset.item}"]`)?.focus();if(selectedItem)toast('已选中'+E.ITEMS[selectedItem].name+'。走近对应物件后使用。');});
  $('#start-button').addEventListener('click',()=>{
    if(!world)return;
    settings.horror=$('#intro-horror').checked;world.setHorror(settings.horror);saveSettings();
    playing=true;$('#intro').hidden=true;document.body.classList.remove('intro-open');
    world.start();dispatch({type:'start'},false);refreshNearby(window.ArchiveNavigation.nearby(world.getPosition())[0]);
    if($('#intro-sound').checked&&!soundEnabled)toggleSound();
    $('#world').focus({preventScroll:true});
    if(state.flags.escaped)showResult();else toast('WASD 移动 · 拖动转向 · 走近物件按 E 调查');
  });
  $('#journal-button').addEventListener('click',showJournal);$('#result-button').addEventListener('click',showResult);$('#help-button').addEventListener('click',showHelp);$('#hint-button').addEventListener('click',()=>showHint(false));$('#sound-button').addEventListener('click',toggleSound);
  $('#close-dialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{world?.pause(!playing);if(playing)$('#world').focus({preventScroll:true});savePosition();});
  dialog.addEventListener('click',e=>{
    if(e.target===dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close();return;}
    const b=e.target.closest('[data-action]');if(!b)return;
    const a=b.dataset.action;
    if(a==='use') {const r=dispatch({type:'use',target:activeTarget,item:selectedItem},false);if(r.success){renderInspect(activeTarget);toast(r.message);if(r.newItem)selectedItem=r.newItem;render();}else $('#puzzle-feedback').textContent=r.message;}
    if(a==='horror'){settings.horror=!settings.horror;world?.setHorror(settings.horror);saveSettings();showSettings();}
    if(a==='markers'){settings.markers=!settings.markers;world?.setMarkers(settings.markers);saveSettings();showSettings();}
    if(a==='reposition'){world?.reset();world?.setState(state.flags);savePosition();if(world)updateMap(world.getPosition());dialog.close();toast('已回到入口，线索与道具已保留。');}
    if(a==='next-hint')showHint(true);
    if(a==='journal')showJournal();
    if(a==='restart')confirmRestart();
    if(a==='cancel')dialog.close();
    if(a==='reset-confirm'){state=E.initialState();state.started=true;selectedItem=null;activeTarget=null;world?.reset();world?.setState(state.flags);savePosition();if(world)updateMap(world.getPosition());dialog.close();render();refreshNearby(null);toast('新的调查，开始了。');}
  });
  dialog.addEventListener('change',e=>{if(e.target.id==='quality-select'){settings.quality=e.target.value;world?.setQuality(settings.quality);saveSettings();}if(e.target.matches('.switch-row input'))e.target.closest('.switch-row').querySelector('.switch-state').textContent=e.target.checked?'闭合':'断开';});
  dialog.addEventListener('input',e=>{if(e.target.matches('.code-input'))e.target.value=e.target.value.replace(/[^0-9]/g,'').slice(0,4);});
  dialog.addEventListener('submit',e=>{
    const form=e.target.closest('[data-puzzle]');if(!form)return;e.preventDefault();
    const type=form.dataset.puzzle,action={type};
    if(type==='safe')action.code=Array.from(form.querySelectorAll('select')).map(s=>s.value).join('');
    else if(type==='power')action.switches=Array.from(form.querySelectorAll('input')).map(i=>i.checked);
    else action.code=new FormData(form).get('code');
    const r=dispatch(action,false);
    if(!r.success){$('#puzzle-feedback').textContent=r.message;return;}
    if(r.newItem)selectedItem=r.newItem;
    render();
    if(state.flags.escaped){showResult();return;}
    if(r.newItem)openDialog('找到新的物品',itemPreview(r.newItem)+(type==='safe'?'<p class="dialog-copy">还有一封信和一张电工便条，已自动记入线索手记。记得翻开手记读一读。</p>':'<p class="dialog-copy">道具已收进随身物品，并为你选中。关闭窗口，寻找它能打开的地方。</p>')+'<button class="primary-button" data-action="cancel">继续调查 <span aria-hidden="true">↗</span></button>','DISCOVERY / 新的发现');
    else {renderInspect(activeTarget);toast(r.message);}
  });
  setInterval(()=>{if(playing&&state.started&&!state.flags.escaped&&!document.hidden){state.playSeconds++;renderTimer();if(state.playSeconds%5===0)save();}},1000);
  document.addEventListener('visibilitychange',()=>{save();savePosition();world?.pause(document.hidden||dialog.open||!playing);if(sound){if(document.hidden)sound.ctx.suspend().catch(()=>{});else if(soundEnabled)sound.ctx.resume().catch(()=>{});}});
  window.addEventListener('pagehide',()=>{save();savePosition();});
  render();
  // The 3D scene enforces proximity for every investigation entry point.
})();
