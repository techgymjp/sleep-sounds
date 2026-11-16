// 眠りの音 — 音を作って鳴らす部分（Web 版とアプリで共通）
// アプリだけの処理（広告・バックグラウンド再生・戻るボタン）は js/app.js

// ── Module definitions ───────────────────────────────────────────────────────
const MODS = [
  { id:'binaural', icon:'🧠', name:L('バイノーラルビート','Binaural Beats'), desc:L('脳波を睡眠周波数へ誘導','Guides brainwaves toward sleep frequencies'), ac:'#9c6cf7',
    params:[
      {id:'baseFreq', lbl:L('ベース周波数','Base frequency'),                         min:80,  max:400, val:200, unit:'Hz'},
      {id:'beatFreq', lbl:L('ビート周波数 (Delta推奨:2Hz)','Beat frequency (Delta: 2 Hz)'), min:0.5, max:8,   val:2,   step:.1, unit:'Hz'},
      {id:'vol',      lbl:L('音量','Volume'),                                         min:0,   max:100, val:60,  unit:'%'},
    ]},
  { id:'rain',  icon:'🌧️', name:L('雨音','Rain'), desc:L('ポツポツ降る雨のしずく','Gentle raindrops'), ac:'#4fc3f7', noise:'rain',
    params:[
      {id:'intensity', lbl:L('雨の強さ','Intensity'),  min:0,   max:100,  val:65,  unit:'%'},
      {id:'highpass',  lbl:L('音の細かさ','Fineness'), min:100, max:3000, val:400, unit:'Hz'},
    ]},
  { id:'ocean', icon:'🌊', name:L('波音','Ocean Waves'), desc:L('寄せては返す波のリズム','The rhythm of rolling waves'), ac:'#26c6da', noise:'brown',
    params:[
      {id:'speed', lbl:L('波の速さ','Wave speed'), min:.03, max:.5, val:.1, step:.01, unit:'Hz'},
      {id:'vol',   lbl:L('音量','Volume'),         min:0,   max:100, val:60,            unit:'%'},
    ]},
  { id:'fire',  icon:'🔥', name:L('焚き火','Campfire'), desc:L('炎のはぜる音','Crackling flames'), ac:'#ff8a50', noise:'fire',
    params:[
      {id:'vol',     lbl:L('音量','Volume'),                          min:0,   max:100,  val:50,  unit:'%'},
      {id:'lowpass', lbl:L('温かさ（ローパス）','Warmth (low-pass)'), min:150, max:2500, val:700, unit:'Hz'},
    ]},
  { id:'white', icon:'🌫️', name:L('ホワイトノイズ','White Noise'), desc:L('全周波数均等・雑音マスキング','Equal energy at all frequencies; masks noise'), ac:'#b0bec5', noise:'white',
    params:[{id:'vol', lbl:L('音量','Volume'), min:0, max:100, val:35, unit:'%'}]},
  { id:'pink',  icon:'💜', name:L('ピンクノイズ','Pink Noise'), desc:L('自然界に最も近いノイズ','The noise closest to nature'), ac:'#f48fb1', noise:'pink',
    params:[{id:'vol', lbl:L('音量','Volume'), min:0, max:100, val:40, unit:'%'}]},
  { id:'brown', icon:'🟤', name:L('ブラウンノイズ','Brown Noise'), desc:L('低周波・重厚な滝のような音','Deep, low rumble like a waterfall'), ac:'#a1887f', noise:'brown',
    params:[{id:'vol', lbl:L('音量','Volume'), min:0, max:100, val:40, unit:'%'}]},
  { id:'solfeggio', icon:'✨', name:L('ソルフェジオ','Solfeggio Drone'), desc:L('周波数が自動で上下するドローン','A drone that slowly drifts up and down'), ac:'#ffd54f',
    params:[
      {id:'freq',       lbl:L('中心周波数','Center frequency'), min:174, max:963, val:528,  unit:'Hz'},
      {id:'vibratoD',   lbl:L('揺らぎ幅','Drift depth'),        min:1,   max:60,  val:18,   unit:'Hz'},
      {id:'vibratoSpd', lbl:L('揺らぎ速さ','Drift speed'),      min:.02, max:.5,  val:.08,  step:.01, unit:'Hz'},
      {id:'vol',        lbl:L('音量','Volume'),                 min:0,   max:100, val:30,   unit:'%'},
    ]},
];

const PRESETS = [
  {id:'sleep',    name:L('🌙 深い眠り','🌙 Deep Sleep'), mods:{binaural:{beatFreq:2,  vol:28},  brown:{vol:55}}},
  {id:'meditate', name:L('🧘 瞑想','🧘 Meditation'),     mods:{binaural:{beatFreq:4.5,vol:32},  solfeggio:{freq:528,vol:22}, pink:{vol:20}}},
  {id:'rain',     name:L('🌧️ 雨の夜','🌧️ Rainy Night'), mods:{rain:{intensity:70, highpass:700}, brown:{vol:30}}},
  {id:'campfire', name:L('🔥 焚き火','🔥 Campfire'),     mods:{fire:{vol:55, lowpass:700}, brown:{vol:22}}},
  {id:'ocean',    name:L('🌊 海辺','🌊 Seaside'),        mods:{ocean:{vol:65, speed:.1}, pink:{vol:18}}},
];

const TIMERS = [0, 15, 30, 60, 90];

// ── Audio state ──────────────────────────────────────────────────────────────
let ctx = null, masterGain = null, analyser = null;
let noiseBufs = null;
let playing = false;
const active = {}, params = {}, nodes = {};
let timerHandle = null, timerEnd = 0, timerRemain = 0, fading = false;

// アプリ（js/app.js）が再生の開始・停止を知るためのフック
//   onStart … 止まっている状態から鳴らし始めるとき（ボタンを押した直後に呼ぶ）
//   onChange … 再生中かどうかが変わったとき
const hooks = { onStart: null, onChange: null };

MODS.forEach(d => {
  active[d.id] = false;
  params[d.id] = {};
  d.params.forEach(p => { params[d.id][p.id] = p.val; });
});

// ── Noise buffer generation ──────────────────────────────────────────────────
function generateNoiseBuffers() {
  const sr = ctx.sampleRate;
  const LEN = sr * 20; // 20-second looping buffers

  // White noise
  const wBuf = ctx.createBuffer(1, LEN, sr);
  const wd = wBuf.getChannelData(0);
  for (let i = 0; i < LEN; i++) wd[i] = Math.random() * 2 - 1;

  // Pink noise (Paul Kellet algorithm)
  const pBuf = ctx.createBuffer(1, LEN, sr);
  const pd = pBuf.getChannelData(0);
  let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
  for (let i = 0; i < LEN; i++) {
    const w = Math.random() * 2 - 1;
    b0=.99886*b0+w*.0555179; b1=.99332*b1+w*.0750759;
    b2=.96900*b2+w*.1538520; b3=.86650*b3+w*.3104856;
    b4=.55000*b4+w*.5329522; b5=-.7616*b5-w*.0168980;
    pd[i] = (b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11;
    b6 = w * .115926;
  }

  // Brown noise
  const brBuf = ctx.createBuffer(1, LEN, sr);
  const brd = brBuf.getChannelData(0);
  let lo = 0;
  for (let i = 0; i < LEN; i++) {
    const w = Math.random() * 2 - 1;
    lo = (lo + .02 * w) / 1.02;
    brd[i] = lo * 3.5;
  }

  // Fire: brown base + prominent crackles with clustering
  const fBuf = ctx.createBuffer(1, LEN, sr);
  const fd = fBuf.getChannelData(0);
  lo = 0;
  let nextCrackle = Math.floor(sr * (Math.random() * .3 + .05));
  for (let i = 0; i < LEN; i++) {
    const w = Math.random() * 2 - 1;
    lo = (lo + .02 * w) / 1.02;
    fd[i] = lo * 2.0;
    if (i >= nextCrackle) {
      // Sharp crack: short burst with fast decay
      const crackLen = Math.floor(sr * (Math.random() * .012 + .003));
      const crackAmp = Math.random() * .7 + .25;
      for (let j = 0; j < crackLen && i + j < LEN; j++) {
        fd[i + j] += (Math.random() * 2 - 1) * crackAmp * Math.exp(-j / (crackLen * .3));
      }
      // Occasionally cluster 2-3 rapid cracks
      if (Math.random() < .35) {
        const extra = Math.floor(sr * (Math.random() * .04 + .01));
        nextCrackle = i + extra;
      } else {
        nextCrackle = i + Math.floor(sr * (Math.random() * .6 + .08));
      }
    }
    fd[i] = Math.max(-1, Math.min(1, fd[i]));
  }

  // Rain: soft ambient base + individual drip impulses
  const rainBuf = ctx.createBuffer(1, LEN, sr);
  const rnd = rainBuf.getChannelData(0);
  b0=b1=b2=b3=b4=b5=b6=0;
  for (let i = 0; i < LEN; i++) {
    const w = Math.random() * 2 - 1;
    b0=.99886*b0+w*.0555179; b1=.99332*b1+w*.0750759;
    b2=.96900*b2+w*.1538520; b3=.86650*b3+w*.3104856;
    b4=.55000*b4+w*.5329522; b5=-.7616*b5-w*.0168980;
    rnd[i] = (b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11 * .25;
    b6 = w * .115926;
  }
  let dropPos = 0;
  while (dropPos < LEN) {
    const amp   = Math.random() * .55 + .15;
    const decay = Math.floor(sr * (Math.random() * .018 + .004));
    for (let j = 0; j < decay * 4 && dropPos + j < LEN; j++) {
      rnd[dropPos + j] += (Math.random() * 2 - 1) * amp * Math.exp(-j / decay);
    }
    dropPos += Math.floor(sr * (Math.random() * .12 + .025));
  }

  return { white: wBuf, pink: pBuf, brown: brBuf, fire: fBuf, rain: rainBuf };
}

function mkNoiseSource(bufKey) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBufs[bufKey];
  src.loop = true;
  src.loopStart = 0;
  src.loopEnd = noiseBufs[bufKey].duration;
  // Randomize start position so simultaneous sources don't phase-cancel
  src.loopStart = 0;
  src.start(0, Math.random() * noiseBufs[bufKey].duration);
  return src;
}

// ── Audio init (同期) ────────────────────────────────────────────────────────
function getOrCreateCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = document.getElementById('masterVol').value / 100;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    masterGain.connect(analyser);
    analyser.connect(ctx.destination);
    noiseBufs = generateNoiseBuffers();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

// ── Module start ─────────────────────────────────────────────────────────────
function startMod(def) {
  if (nodes[def.id]) return;
  const p = params[def.id];
  let n = {};

  if (def.id === 'binaural') {
    const g = ctx.createGain();
    g.gain.value = (p.vol || 60) / 100 * .5;
    g.connect(masterGain);
    const oL = ctx.createOscillator(); oL.type = 'sine';
    oL.frequency.value = p.baseFreq || 200;
    const pL = ctx.createStereoPanner(); pL.pan.value = -1;
    oL.connect(pL); pL.connect(g); oL.start();
    const oR = ctx.createOscillator(); oR.type = 'sine';
    oR.frequency.value = (p.baseFreq || 200) + (p.beatFreq || 2);
    const pR = ctx.createStereoPanner(); pR.pan.value = 1;
    oR.connect(pR); pR.connect(g); oR.start();
    n = { oL, oR, pL, pR, g };

  } else if (def.id === 'solfeggio') {
    const g = ctx.createGain();
    g.gain.value = (p.vol || 30) / 100 * .16;
    g.connect(masterGain);
    const o1 = ctx.createOscillator(); o1.type = 'sine';
    o1.frequency.value = p.freq || 528;
    const o2 = ctx.createOscillator(); o2.type = 'sine';
    o2.frequency.value = (p.freq || 528) * 2;
    const hg = ctx.createGain(); hg.gain.value = .18;
    // LFO for automatic frequency sweep
    const vLFO = ctx.createOscillator(); vLFO.type = 'sine';
    vLFO.frequency.value = p.vibratoSpd || .08;
    const vDepth1 = ctx.createGain(); vDepth1.gain.value = p.vibratoD || 18;
    const vDepth2 = ctx.createGain(); vDepth2.gain.value = (p.vibratoD || 18) * 2;
    vLFO.connect(vDepth1); vDepth1.connect(o1.frequency);
    vLFO.connect(vDepth2); vDepth2.connect(o2.frequency);
    vLFO.start();
    o1.connect(g); o1.start();
    o2.connect(hg); hg.connect(g); o2.start();
    n = { o1, o2, hg, g, vLFO, vDepth1, vDepth2 };

  } else if (def.id === 'ocean') {
    const src = mkNoiseSource('brown');
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 450; bp.Q.value = .6;
    // LFO for wave motion
    const lfoG = ctx.createGain(); lfoG.gain.value = .5;
    const lfo = ctx.createOscillator(); lfo.type = 'sine';
    lfo.frequency.value = p.speed || .1;
    const lfoD = ctx.createGain(); lfoD.gain.value = .45;
    const vG = ctx.createGain(); vG.gain.value = (p.vol || 60) / 100;
    src.connect(bp); bp.connect(lfoG); lfoG.connect(vG); vG.connect(masterGain);
    lfo.connect(lfoD); lfoD.connect(lfoG.gain); lfo.start();
    n = { src, bp, lfo, lfoD, lfoG, vG };

  } else if (def.id === 'rain') {
    const src = mkNoiseSource('rain');
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass';
    hp.frequency.value = p.highpass || 400;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = 12000;
    const g = ctx.createGain(); g.gain.value = (p.intensity || 65) / 100;
    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(masterGain);
    n = { src, hp, lp, g };

  } else if (def.id === 'fire') {
    const src = mkNoiseSource('fire');
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = p.lowpass || 700;
    // LFO でめらめら揺らぎ
    const lfoG = ctx.createGain(); lfoG.gain.value = .65;
    const lfo  = ctx.createOscillator(); lfo.type = 'sine';
    lfo.frequency.value = .7 + Math.random() * .4; // 0.7-1.1Hz
    const lfoD = ctx.createGain(); lfoD.gain.value = .28;
    lfo.connect(lfoD); lfoD.connect(lfoG.gain); lfo.start();
    const g = ctx.createGain(); g.gain.value = (p.vol || 50) / 100;
    src.connect(lp); lp.connect(lfoG); lfoG.connect(g); g.connect(masterGain);
    n = { src, lp, lfoG, lfo, lfoD, g };

  } else {
    // white / pink / brown
    const src = mkNoiseSource(def.noise);
    const g = ctx.createGain(); g.gain.value = (p.vol || 40) / 100;
    src.connect(g); g.connect(masterGain);
    n = { src, g };
  }

  nodes[def.id] = n;
}

// ── Module stop ──────────────────────────────────────────────────────────────
function stopMod(def) {
  const n = nodes[def.id]; if (!n) return;
  ['oL','oR','o1','o2','lfo','vLFO','src'].forEach(k => {
    if (n[k]) { try { n[k].stop(0); } catch(e) {} }
  });
  Object.values(n).forEach(x => { if (x && x.disconnect) try { x.disconnect(); } catch(e) {} });
  delete nodes[def.id];
}

// ── Param update ─────────────────────────────────────────────────────────────
function updateParam(defId, paramId, val) {
  params[defId][paramId] = val;
  const n = nodes[defId]; if (!n || !active[defId]) return;
  const t = ctx.currentTime;
  if (defId === 'binaural') {
    const p = params[defId], base = p.baseFreq||200, beat = p.beatFreq||2;
    if (n.oL) n.oL.frequency.setTargetAtTime(base,       t, .1);
    if (n.oR) n.oR.frequency.setTargetAtTime(base + beat, t, .1);
    if (paramId === 'vol' && n.g) n.g.gain.setTargetAtTime(val/100*.5, t, .05);
  } else if (defId === 'solfeggio') {
    if (paramId === 'freq') {
      if (n.o1) n.o1.frequency.setTargetAtTime(val,   t, .2);
      if (n.o2) n.o2.frequency.setTargetAtTime(val*2, t, .2);
    }
    if (paramId === 'vibratoD') {
      if (n.vDepth1) n.vDepth1.gain.setTargetAtTime(val,   t, .1);
      if (n.vDepth2) n.vDepth2.gain.setTargetAtTime(val*2, t, .1);
    }
    if (paramId === 'vibratoSpd' && n.vLFO) n.vLFO.frequency.setTargetAtTime(val, t, .1);
    if (paramId === 'vol' && n.g) n.g.gain.setTargetAtTime(val/100*.16, t, .05);
  } else if (defId === 'ocean') {
    if (paramId === 'speed' && n.lfo) n.lfo.frequency.setTargetAtTime(val, t, .5);
    if (paramId === 'vol'   && n.vG)  n.vG.gain.setTargetAtTime(val/100,  t, .05);
  } else if (defId === 'rain') {
    if (paramId === 'highpass'  && n.hp) n.hp.frequency.setTargetAtTime(val,    t, .1);
    if (paramId === 'intensity' && n.g)  n.g.gain.setTargetAtTime(val/100, t, .05);
  } else if (defId === 'fire') {
    if (paramId === 'lowpass' && n.lp) n.lp.frequency.setTargetAtTime(val, t, .1);
    if (paramId === 'vol'     && n.g)  n.g.gain.setTargetAtTime(val/100,  t, .05);
  } else {
    if (paramId === 'vol' && n.g) n.g.gain.setTargetAtTime(val/100, t, .05);
  }
}


// ── Playing state ────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function setPlaying(v) {
  if (playing === v) return;
  playing = v;
  $('playBtn').textContent = v ? '⏸' : '▶';
  $('playBtn').classList.toggle('on', v);
  // タイマーは鳴らしているあいだだけ減らす
  if (v) runTimer(); else pauseTimer();
  if (hooks.onChange) hooks.onChange(v);
}

// 鳴らし始める（ボタンの操作の中で呼ぶ）。止まっていたなら、オンの音をすべて鳴らし直す
function ensurePlaying() {
  getOrCreateCtx();
  if (playing) return;
  setPlaying(true);
  if (hooks.onStart) hooks.onStart();
  for (const d of MODS) { if (active[d.id]) startMod(d); }
}

// 一時停止（オン・オフの設定は残す）
function pausePlayback() {
  MODS.forEach(d => { if (active[d.id]) stopMod(d); });
  if (ctx) ctx.suspend();
  setPlaying(false);
}

// すべての音をオフにして止める（タイマーの終わり・通知の「停止」）
function stopAll() {
  MODS.forEach(d => { stopMod(d); active[d.id] = false; syncCard(d); });
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  if (ctx) ctx.suspend();
  setPlaying(false);
  setTimer(0);
}

function checkAllOff() {
  if (!Object.values(active).some(v => v)) setPlaying(false);
}

// ── Timer ────────────────────────────────────────────────────────────────────
// 減るのは鳴らしているあいだだけ。止めるとその時点の残り時間で止まり、▶ で続きから減る。
// 止まっているときに選んだら、時間だけを覚えておき、鳴らし始めたときから減り始める。
// 動いているあいだは終わる時刻を覚えておき、残り時間はそこから計算する
// （画面を消しているあいだにタイマー処理が遅れても、ずれないようにするため）
function restoreMasterGain() {
  fading = false;
  if (!masterGain || !ctx) return;
  masterGain.gain.cancelScheduledValues(ctx.currentTime);
  masterGain.gain.setValueAtTime($('masterVol').value / 100, ctx.currentTime);
}

function timerLeftMs() {
  return timerHandle ? Math.max(0, timerEnd - Date.now()) : timerRemain;
}

function showTimer() {
  if (!timerRemain && !timerHandle) { $('timerDisplay').textContent = ''; return; }
  const left = Math.round(timerLeftMs() / 1000);
  const m = Math.floor(left / 60), s = left % 60;
  const paused = timerHandle ? '' : L('（停止中）', ' (paused)');
  $('timerDisplay').textContent = `${L('残り','Left')} ${m}:${String(s).padStart(2,'0')}${paused}`;
}

function runTimer() {
  if (timerHandle || !timerRemain) return;
  timerEnd = Date.now() + timerRemain;
  timerHandle = setInterval(tickTimer, 1000);
  tickTimer();
}

function pauseTimer() {
  if (!timerHandle) return;
  timerRemain = Math.max(1000, timerEnd - Date.now());
  clearInterval(timerHandle); timerHandle = null;
  if (fading) restoreMasterGain();
  showTimer();
}

function setTimer(min) {
  clearInterval(timerHandle); timerHandle = null;
  if (fading) restoreMasterGain();
  timerRemain = min * 60000;
  document.querySelectorAll('.timer-btn').forEach(b => b.classList.toggle('active', +b.dataset.min === min));
  if (playing) runTimer(); else showTimer();
}

function tickTimer() {
  const left = Math.round(timerLeftMs() / 1000);
  showTimer();
  // 最後の 30 秒でゆっくり音を小さくする
  if (left <= 30 && !fading && masterGain && ctx) {
    fading = true;
    const t = ctx.currentTime;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setValueAtTime(masterGain.gain.value, t);
    masterGain.gain.linearRampToValueAtTime(0, t + Math.max(left, 1));
  }
  if (left <= 0) {
    stopAll();
    restoreMasterGain();
  }
}

// ── UI helpers ───────────────────────────────────────────────────────────────
function fmt(p, v) {
  if (p.unit === '%')  return `${Math.round(v)}%`;
  if (p.unit.includes('Hz')) return `${parseFloat(v).toFixed(p.step && p.step < 1 ? 2 : 0)} Hz`;
  return v;
}
function syncCard(def) {
  document.getElementById(`card-${def.id}`)?.classList.toggle('on', active[def.id]);
  const tog = document.getElementById(`tog-${def.id}`);
  if (tog) tog.checked = active[def.id];
}
function buildCard(def) {
  const card = document.createElement('div');
  card.className = 'card'; card.id = `card-${def.id}`;
  card.style.setProperty('--ac', def.ac);

  const head = document.createElement('div'); head.className = 'card-head';
  const title = document.createElement('div'); title.className = 'card-title';
  title.innerHTML = `<span class="card-icon">${def.icon}</span><span>${def.name}</span>`;
  const tog = document.createElement('label'); tog.className = 'tog';
  const inp = document.createElement('input'); inp.type = 'checkbox'; inp.id = `tog-${def.id}`;
  const sl  = document.createElement('span'); sl.className = 'tog-sl';
  tog.append(inp, sl);
  inp.addEventListener('change', () => {
    active[def.id] = inp.checked;
    syncCard(def);
    if (inp.checked) {
      if (playing) startMod(def); else ensurePlaying();
    } else {
      stopMod(def);
      checkAllOff();
    }
  });
  head.append(title, tog); card.append(head);

  def.params.forEach(p => {
    const row = document.createElement('div'); row.className = 'param';
    const lbl = document.createElement('div'); lbl.className = 'param-lbl';
    const lt = document.createElement('span'); lt.textContent = p.lbl;
    const vt = document.createElement('span'); vt.className = 'param-val';
    vt.id = `v-${def.id}-${p.id}`; vt.textContent = fmt(p, p.val);
    lbl.append(lt, vt);
    const range = document.createElement('input'); range.type = 'range';
    range.min = p.min; range.max = p.max; range.value = p.val;
    range.id = `r-${def.id}-${p.id}`;
    if (p.step) range.step = p.step;
    range.style.setProperty('--ac', def.ac);
    range.addEventListener('input', () => {
      const v = parseFloat(range.value);
      vt.textContent = fmt(p, v);
      updateParam(def.id, p.id, v);
    });
    row.append(lbl, range); card.append(row);
  });

  if (def.desc) {
    const d = document.createElement('div'); d.className = 'card-desc'; d.textContent = def.desc;
    card.append(d);
  }
  return card;
}

function applyPreset(preset) {
  MODS.forEach(d => { stopMod(d); active[d.id] = false; syncCard(d); });
  for (const [mid, overrides] of Object.entries(preset.mods)) {
    const def = MODS.find(d => d.id === mid); if (!def) continue;
    Object.entries(overrides).forEach(([k, v]) => {
      params[mid][k] = v;
      const r  = $(`r-${mid}-${k}`);
      const vt = $(`v-${mid}-${k}`);
      const pd = def.params.find(pp => pp.id === k);
      if (r)  r.value = v;
      if (vt && pd) vt.textContent = fmt(pd, v);
    });
    active[mid] = true; syncCard(def);
  }
  if (playing) { for (const d of MODS) { if (active[d.id]) startMod(d); } }
  else ensurePlaying();
  document.querySelectorAll('.preset-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.id === preset.id));
}

// ── Master play button ───────────────────────────────────────────────────────
$('playBtn').addEventListener('click', () => {
  if (playing) { pausePlayback(); return; }
  // 何もオンになっていなければ「深い眠り」で始める
  if (!Object.values(active).some(v => v)) { applyPreset(PRESETS[0]); return; }
  ensurePlaying();
});

$('masterVol').addEventListener('input', e => {
  if (masterGain && ctx && !fading) masterGain.gain.setTargetAtTime(e.target.value / 100, ctx.currentTime, .05);
});

// ── Stars background ─────────────────────────────────────────────────────────
(function () {
  const cv = document.getElementById('stars');
  const cx = cv.getContext('2d');
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  const stars = Array.from({length:160}, () => ({
    x: Math.random() * cv.width, y: Math.random() * cv.height,
    r: Math.random() * 1.4 + .3,
    a: Math.random() * .6 + .1,
    sp: Math.random() * .015 + .004,
    ph: Math.random() * Math.PI * 2,
  }));
  let t = 0;
  (function draw() {
    cx.clearRect(0, 0, cv.width, cv.height); t += .016;
    stars.forEach(s => {
      const a = s.a * (.5 + .5 * Math.sin(t * s.sp * 60 + s.ph));
      cx.beginPath(); cx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      cx.fillStyle = `rgba(200,220,255,${a})`; cx.fill();
    });
    requestAnimationFrame(draw);
  })();
  window.addEventListener('resize', () => { cv.width = window.innerWidth; cv.height = window.innerHeight; });
})();

// ── Visualizer ───────────────────────────────────────────────────────────────
(function () {
  const cv = document.getElementById('vizCanvas');
  const cx = cv.getContext('2d');
  (function draw() {
    requestAnimationFrame(draw);
    cx.clearRect(0, 0, cv.width, cv.height);
    if (!analyser || !playing) {
      cx.strokeStyle = 'rgba(79,195,247,.25)'; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(0, cv.height/2); cx.lineTo(cv.width, cv.height/2); cx.stroke();
      return;
    }
    const buf = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(buf);
    cx.strokeStyle = '#4fc3f7'; cx.lineWidth = 1.5;
    cx.shadowColor = '#4fc3f7'; cx.shadowBlur = 5;
    cx.beginPath();
    const step = cv.width / buf.length;
    buf.forEach((v, i) => {
      const y = (v/128 - 1) * (cv.height/2) + cv.height/2;
      i ? cx.lineTo(i*step, y) : cx.moveTo(0, y);
    });
    cx.stroke(); cx.shadowBlur = 0;
  })();
})();


// ── Build UI ─────────────────────────────────────────────────────────────────
$('appTitle').textContent = L('🌙 眠りの音', '🌙 Sleep Sounds');
$('masterLbl').textContent = L('マスター音量', 'Master volume');
$('timerLbl').textContent = L('タイマー：', 'Timer:');
$('footerNote').textContent = L('ヘッドフォン推奨（バイノーラルビート使用時）', 'Headphones recommended for binaural beats');
$('privacyLink').textContent = L('プライバシーポリシー', 'Privacy Policy');
$('privacyLink').href = L('https://techgym.jp/privacy-policy/', 'https://techgym.jp/privacy-policy-en/');
$('adPrivacyLink').textContent = L('広告の設定', 'Ad settings');
if (window.APP_VERSION && window.APP_VERSION !== 'dev') $('buildInfo').textContent = window.APP_VERSION;

const grid = $('grid');
MODS.forEach(d => grid.appendChild(buildCard(d)));

const presetsEl = $('presets');
PRESETS.forEach(p => {
  const btn = document.createElement('button');
  btn.className = 'preset-btn'; btn.dataset.id = p.id; btn.textContent = p.name;
  btn.addEventListener('click', () => applyPreset(p));
  presetsEl.appendChild(btn);
});

TIMERS.forEach(min => {
  const b = document.createElement('button');
  b.className = 'timer-btn' + (min === 0 ? ' active' : '');
  b.dataset.min = min;
  b.textContent = min === 0 ? L('なし', 'Off') : L(`${min}分`, `${min} min`);
  b.addEventListener('click', () => setTimer(min));
  $('timerRow').insertBefore(b, $('timerDisplay'));
});

// アプリ（js/app.js）と広告（js/ads.js）から使う
window.Sound = {
  get playing() { return playing; },
  hooks,
  pause: pausePlayback,
  stopAll,
  // 全画面広告を出しているあいだだけ音を止める
  suspend() { if (ctx) ctx.suspend(); },
  resume() { if (ctx && playing) ctx.resume(); },
};
