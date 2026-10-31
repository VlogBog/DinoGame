'use strict';

(() => {
  // ================== НАСТРОЙКИ ==================
  const BASE_H = 300;          // логическа височина на сцената
  const GROUND_Y = 250;        // линия на земята
  const GRAVITY = 2600;
  const JUMP_V = -880;         // сила на скока
  const MIN_JUMP_V = -430;     // кратко натискане = по-нисък скок
  const FAST_FALL_V = 1100;    // бързо падане при ↓ във въздуха
  const START_SPEED = 380;
  const MAX_SPEED = 980;
  const ACCEL = 7;             // с колко се ускорява играта всяка секунда
  const SCORE_DIV = 22;        // пиксели за 1 точка
  const PTERO_FROM = 300;      // от колко точки идват птеродактилите
  const STORAGE_KEY = 'dinoPrehistoric.best';
  const TAU = Math.PI * 2;

  const C = {
    body: '#5cc43a',
    dark: '#3a8f22',
    belly: '#dcf7a0',
    spike: '#ff8a3d',
    eye: '#1d2a1a',
    cheek: 'rgba(255, 120, 150, 0.55)'
  };

  // ================== DOM ==================
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = $('score');
  const bestEl = $('best');
  const scoreBox = $('scoreBox');
  const bestBox = $('bestBox');
  const pauseBtn = $('pauseBtn');
  const screens = {
    start: $('startScreen'),
    pause: $('pauseScreen'),
    over: $('gameOverScreen')
  };
  const finalScoreEl = $('finalScore');
  const finalBestEl = $('finalBest');
  const newRecordEl = $('newRecord');

  // ================== СЪСТОЯНИЕ ==================
  const MIN_W = 420;  // минимална видима ширина на игралното поле
  let W = 600;        // логическа ширина (зависи от екрана)
  let H = BASE_H;     // логическа височина (по-голяма на вертикален екран)
  let topPad = 0;     // допълнително небе отгоре при вертикален екран
  let pxScale = 1;
  let maxSpeed = MAX_SPEED;

  const game = {
    state: 'menu',    // menu | playing | paused | over
    speed: START_SPEED,
    offset: 0,        // колко е превъртян светът (за фона)
    distance: 0,
    score: 0,
    best: loadBest(),
    time: 0,
    nextGap: 0,
    shake: 0,
    milestone: 0,
    canRestartAt: 0
  };

  const dino = {
    x: 56, y: 0, vy: 0,
    onGround: true, ducking: false, dead: false,
    runT: 0, dustT: 0,
    blink: 0, blinkTimer: 3
  };

  const input = { down: false, jumpHeld: false, jumpBuffer: 0 };

  let obstacles = [];
  let particles = [];

  // ================== ПОМОЩНИ ==================
  const rand = (a, b) => a + Math.random() * (b - a);
  const hash = (n) => {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return s - Math.floor(s);
  };
  const pad = (n) => String(Math.floor(n)).padStart(5, '0');

  function loadBest() {
    try {
      const v = parseInt(localStorage.getItem(STORAGE_KEY), 10);
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch (e) {
      return 0;
    }
  }

  function saveBest(v) {
    try { localStorage.setItem(STORAGE_KEY, String(v)); } catch (e) { /* няма достъп */ }
  }

  function ell(x, y, rx, ry, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
    ctx.fill();
  }

  function ellStroke(x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
    ctx.stroke();
  }

  function circle(x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
    ctx.fill();
  }

  // ================== РАЗМЕР НА ЕКРАНА ==================
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);

    // Мащаб: полето винаги е поне MIN_W широко и BASE_H високо
    const cssScale = Math.min(r.height / BASE_H, r.width / MIN_W);
    pxScale = cssScale * dpr;
    W = r.width / cssScale;
    H = r.height / cssScale;

    // Излишната височина отива предимно за небе, останалото – за земя
    topPad = Math.max(0, (H - BASE_H) * 0.6);

    // На тесни екрани по-малка максимална скорост, за да има време за реакция
    maxSpeed = MAX_SPEED * Math.min(1, Math.max(0.78, W / 650));
  }

  // ================== ФОН ==================
  function drawSky() {
    const top = -topPad - 20;
    const g = ctx.createLinearGradient(0, top, 0, GROUND_Y);
    g.addColorStop(0, topPad > 0 ? '#2a9fc9' : '#3fb6d3');
    g.addColorStop(0.5, '#8fd6c9');
    g.addColorStop(0.82, '#ffd9a0');
    g.addColorStop(1, '#ffbf7a');
    ctx.fillStyle = g;
    ctx.fillRect(-20, top, W + 40, GROUND_Y - top + 20);

    // Слънце
    const sx = W * 0.62, sy = 74 - topPad * 0.3;
    const glow = ctx.createRadialGradient(sx, sy, 10, sx, sy, 80);
    glow.addColorStop(0, 'rgba(255, 244, 190, 0.9)');
    glow.addColorStop(1, 'rgba(255, 244, 190, 0)');
    ctx.fillStyle = glow;
    circle(sx, sy, 80);
    ctx.fillStyle = '#fff4c2';
    circle(sx, sy, 26);
  }

  function drawCloud(x, y, s) {
    ctx.fillStyle = '#fffaf0';
    circle(x, y, 13 * s);
    circle(x + 15 * s, y - 8 * s, 17 * s);
    circle(x + 33 * s, y - 3 * s, 14 * s);
    circle(x + 47 * s, y + 2 * s, 10 * s);
    ell(x + 22 * s, y + 6 * s, 30 * s, 8 * s);
  }

  function cloudRow(sp, f, drift, yMin, yRange, seed, sMin, sRange) {
    const base = game.offset * f + game.time * drift;
    const i0 = Math.floor(base / sp) - 1;
    const i1 = Math.floor((base + W) / sp) + 1;
    for (let i = i0; i <= i1; i++) {
      const n = i + seed;
      if (hash(n) < 0.4) continue;
      const x = i * sp + hash(n + 3) * 120 - base;
      const y = yMin + hash(n + 5) * yRange;
      drawCloud(x, y, sMin + hash(n + 9) * sRange);
    }
  }

  function drawClouds() {
    // Допълнителни (по-далечни) облаци горе, ако небето е високо
    if (topPad > 60) {
      cloudRow(200, 0.03, 6, -topPad + 30, topPad * 0.75, 500, 0.45, 0.5);
    }
    cloudRow(240, 0.06, 10, 30 - topPad * 0.15, 55 + topPad * 0.15, 0, 0.6, 0.6);
  }

  function drawVolcano(cx, by, w, h, seed) {
    const top = by - h;
    const cw = 15;

    // Дим
    for (let k = 0; k < 5; k++) {
      const t = (game.time * 0.22 + k / 5 + hash(seed)) % 1;
      ctx.fillStyle = `rgba(115, 100, 125, ${0.45 * (1 - t)})`;
      circle(cx + Math.sin(t * 4 + k) * 6 + t * 26, top - 6 - t * 70, 7 + t * 20);
    }

    // Сияние от лавата
    const glow = ctx.createRadialGradient(cx, top, 2, cx, top, 40);
    glow.addColorStop(0, 'rgba(255, 140, 60, 0.7)');
    glow.addColorStop(1, 'rgba(255, 140, 60, 0)');
    ctx.fillStyle = glow;
    circle(cx, top, 40);

    // Тяло
    ctx.fillStyle = '#a77d9f';
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, by);
    ctx.quadraticCurveTo(cx - w * 0.22, by - h * 0.55, cx - cw, top);
    ctx.lineTo(cx + cw, top);
    ctx.quadraticCurveTo(cx + w * 0.22, by - h * 0.55, cx + w / 2, by);
    ctx.closePath();
    ctx.fill();

    // Сянка от дясната страна
    ctx.fillStyle = 'rgba(80, 50, 90, 0.18)';
    ctx.beginPath();
    ctx.moveTo(cx + 2, top);
    ctx.lineTo(cx + cw, top);
    ctx.quadraticCurveTo(cx + w * 0.22, by - h * 0.55, cx + w / 2, by);
    ctx.lineTo(cx + w * 0.1, by);
    ctx.closePath();
    ctx.fill();

    // Кратер и лава
    ctx.fillStyle = '#ff7b39';
    ell(cx, top + 1, cw, 3.5);
    ctx.strokeStyle = '#ff9a3c';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 6, top + 2);
    ctx.quadraticCurveTo(cx - 11, top + h * 0.28, cx - 20, top + h * 0.42);
    ctx.moveTo(cx + 5, top + 2);
    ctx.quadraticCurveTo(cx + 9, top + h * 0.2, cx + 15, top + h * 0.3);
    ctx.stroke();
  }

  function drawVolcanoes() {
    const sp = 460;
    const base = game.offset * 0.05;
    const i0 = Math.floor(base / sp) - 1;
    const i1 = Math.floor((base + W) / sp) + 1;
    for (let i = i0; i <= i1; i++) {
      if (hash(i * 1.7 + 2) < 0.35) continue;
      const cx = i * sp + hash(i + 11) * 200 - base;
      drawVolcano(cx, 216, 170 + hash(i + 31) * 90, 80 + hash(i + 21) * 55, i);
    }
  }

  function ridge(f, baseY, fn, fill) {
    const off = game.offset * f;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(-20, BASE_H);
    for (let x = -20; x <= W + 32; x += 12) ctx.lineTo(x, baseY - fn(x + off));
    ctx.lineTo(W + 32, BASE_H);
    ctx.closePath();
    ctx.fill();
  }

  const mountainH = (wx) =>
    55 + 22 * Math.sin(wx * 0.0075) + 14 * Math.sin(wx * 0.019 + 1.3) + 6 * Math.sin(wx * 0.045 + 0.5);
  const hillH = (wx) =>
    22 + 10 * Math.sin(wx * 0.012) + 6 * Math.sin(wx * 0.031 + 2);

  function drawMountains() {
    const g = ctx.createLinearGradient(0, 140, 0, 236);
    g.addColorStop(0, '#8279bd');
    g.addColorStop(1, '#a9a3d6');
    ridge(0.12, 238, mountainH, g);
  }

  function drawPalm(x, y, h, lean, color) {
    const tx = x + lean * h * 0.22;
    const ty = y - h;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + lean * h * 0.03, y - h * 0.6, tx, ty);
    ctx.stroke();

    ctx.fillStyle = color;
    const L = h * 0.42;
    for (const a of [-2.95, -2.35, -1.6, -0.85, -0.2]) {
      const droop = Math.abs(Math.cos(a)) * 5;
      ell(tx + Math.cos(a) * L * 0.5, ty + Math.sin(a) * L * 0.5 + droop, L * 0.52, 3.6, a);
    }
  }

  function drawJungle() {
    const f = 0.3;
    const off = game.offset * f;
    const base = GROUND_Y + 2;

    // Палми зад хълма
    const sp = 70;
    const i0 = Math.floor((off - 60) / sp);
    const i1 = Math.floor((off + W + 60) / sp);
    for (let i = i0; i <= i1; i++) {
      if (hash(i + 50) < 0.45) continue;
      const wx = i * sp + hash(i + 60) * 40;
      const x = wx - off;
      drawPalm(x, base - hillH(wx) + 8, 42 + hash(i + 70) * 40, hash(i + 80) < 0.5 ? -1 : 1, '#2c7343');
    }

    ridge(f, base, hillH, '#3e9157');

    // Храсти по хълма
    ctx.fillStyle = '#357f4c';
    const bs = 34;
    const b0 = Math.floor((off - 40) / bs);
    const b1 = Math.floor((off + W + 40) / bs);
    for (let i = b0; i <= b1; i++) {
      if (hash(i + 90) < 0.3) continue;
      const wx = i * bs + hash(i + 95) * 20;
      ell(wx - off, base - hillH(wx) + 4, 10 + hash(i + 99) * 8, 7 + hash(i + 97) * 5);
    }
  }

  function drawBone(x, y) {
    ctx.fillStyle = '#f1e6cf';
    rrect(x - 6, y - 1.2, 12, 2.4, 1);
    circle(x - 6, y - 1.4, 1.8);
    circle(x - 6, y + 1.4, 1.8);
    circle(x + 6, y - 1.4, 1.8);
    circle(x + 6, y + 1.4, 1.8);
  }

  function drawAmmonite(x, y) {
    ctx.strokeStyle = '#ead6b2';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let t = 0; t <= 4 * Math.PI; t += 0.3) {
      const r = 0.6 + t * 0.45;
      const px = x + Math.cos(t) * r;
      const py = y + Math.sin(t) * r;
      if (t === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  function drawGround() {
    const off = game.offset;
    const bottom = H - topPad + 20;

    const g = ctx.createLinearGradient(0, GROUND_Y, 0, bottom);
    g.addColorStop(0, '#c0843f');
    g.addColorStop(Math.min(1, 50 / (bottom - GROUND_Y)), '#9a6230');
    g.addColorStop(1, '#5e3519');
    ctx.fillStyle = g;
    ctx.fillRect(-20, GROUND_Y, W + 40, bottom - GROUND_Y + 20);

    // Пластове пръст (повтарят се надолу, ако земята е дълбока)
    let layer = 0;
    for (let y0 = GROUND_Y + 26; y0 < bottom; y0 += 30, layer++) {
      const dark = layer % 2 === 0;
      ctx.lineWidth = dark ? 5 : 3;
      ctx.strokeStyle = dark ? 'rgba(90, 45, 18, 0.35)' : 'rgba(230, 170, 100, 0.22)';
      ctx.beginPath();
      for (let x = -20; x <= W + 32; x += 16) {
        const y = y0 + 3 * Math.sin((x + off) * (0.022 + layer * 0.004) + layer);
        if (x === -20) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Камъчета, кости и вкаменелости
    const sp = 60;
    const i0 = Math.floor(off / sp) - 1;
    const i1 = Math.floor((off + W) / sp) + 1;
    const bands = Math.max(1, Math.floor((bottom - GROUND_Y - 30) / 32));
    for (let b = 0; b < bands; b++) {
      for (let i = i0; i <= i1; i++) {
        const n = i + b * 1000;
        const h = hash(n + 200);
        if (h < 0.35) continue;
        const x = i * sp + hash(n + 210) * 40 - off;
        const y = GROUND_Y + 15 + b * 32 + hash(n + 220) * 28;
        if (h > 0.93) drawBone(x, y);
        else if (h > 0.87) drawAmmonite(x, y);
        else {
          ctx.fillStyle = hash(n + 230) > 0.5 ? '#6e4423' : '#d9b38c';
          ell(x, y, 2 + hash(n + 240) * 2.5, 1.5 + hash(n + 250) * 1.5);
        }
      }
    }

    // Трева
    ctx.fillStyle = '#6cc23a';
    ctx.fillRect(-20, GROUND_Y - 1, W + 40, 7);
    ctx.fillStyle = '#4f9e2a';
    ctx.fillRect(-20, GROUND_Y + 6, W + 40, 2);

    const ts = 10;
    const t0 = Math.floor(off / ts) - 1;
    const t1 = Math.floor((off + W) / ts) + 2;
    for (const pass of [0, 1]) {
      ctx.fillStyle = pass ? '#86dc4c' : '#58ad30';
      ctx.beginPath();
      for (let i = t0; i <= t1; i++) {
        if ((i & 1) !== pass) continue;
        const x = i * ts - off;
        const h = 3 + hash(i + 300) * 5;
        ctx.moveTo(x, GROUND_Y);
        ctx.lineTo(x + 3, GROUND_Y - h);
        ctx.lineTo(x + 6, GROUND_Y);
      }
      ctx.fill();
    }
  }

  // ================== ДИНОЗАВЪР ==================
  function spikes(list) {
    ctx.fillStyle = C.spike;
    ctx.beginPath();
    for (const [x, y, s] of list) {
      ctx.moveTo(x - s, y + 3);
      ctx.lineTo(x - 1, y - s * 1.5);
      ctx.lineTo(x + s, y + 3);
      ctx.closePath();
    }
    ctx.fill();
  }

  function eye(x, y, r) {
    ctx.lineCap = 'round';
    if (dino.dead) {
      ctx.strokeStyle = C.eye;
      ctx.lineWidth = 1.8;
      const d = r * 0.7;
      ctx.beginPath();
      ctx.moveTo(x - d, y - d); ctx.lineTo(x + d, y + d);
      ctx.moveTo(x + d, y - d); ctx.lineTo(x - d, y + d);
      ctx.stroke();
      return;
    }
    if (dino.blink > 0) {
      ctx.strokeStyle = C.eye;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x - r, y);
      ctx.quadraticCurveTo(x, y + r * 0.6, x + r, y);
      ctx.stroke();
      return;
    }
    ctx.fillStyle = '#fff';
    circle(x, y, r);
    ctx.fillStyle = C.eye;
    circle(x + r * 0.3, y, r * 0.55);
    ctx.fillStyle = '#fff';
    circle(x + r * 0.45, y - r * 0.3, r * 0.2);
  }

  function mouth(x1, y1, cx, cy, x2, y2) {
    if (dino.dead) {
      ctx.fillStyle = '#7a2a2a';
      ell((x1 + x2) / 2, cy - 1, 2.6, 2);
      return;
    }
    ctx.strokeStyle = C.dark;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(cx, cy, x2, y2);
    ctx.stroke();
  }

  function leg(x, lift) {
    rrect(x, -22, 8, 22 - lift, 3);
    rrect(x - 1, -5 - lift, 12, 5, 2.5);
  }

  function legDuck(x, lift) {
    rrect(x, -12, 7, 12 - lift, 3);
    rrect(x - 1, -4 - lift, 11, 4, 2);
  }

  function drawDinoStand(back, front) {
    // Задният крак
    ctx.fillStyle = C.dark;
    leg(15, back);

    // Опашка
    ctx.fillStyle = C.body;
    ctx.beginPath();
    ctx.moveTo(16, -40);
    ctx.quadraticCurveTo(0, -40, -8, -52);
    ctx.quadraticCurveTo(-2, -30, 18, -22);
    ctx.closePath();
    ctx.fill();

    // Шипове
    spikes([[2, -43, 3], [10, -45, 4], [19, -47, 4.5], [27, -48, 4.5], [35, -47, 4], [38, -66, 3], [45, -67, 3]]);

    // Тяло
    ctx.fillStyle = C.body;
    ell(26, -32, 18, 16);

    // Петна
    ctx.fillStyle = 'rgba(46, 120, 30, 0.55)';
    ell(17, -38, 3, 2.2);
    ell(24, -42, 2.5, 2);
    ell(13, -31, 2, 1.6);

    // Корем
    ctx.fillStyle = C.belly;
    ell(31, -27, 10, 11);

    // Предният крак
    ctx.fillStyle = C.body;
    leg(28, front);

    // Ръчичка
    ctx.fillStyle = C.dark;
    ctx.save();
    ctx.translate(40, -32);
    ctx.rotate(0.5);
    rrect(-2, 0, 5, 9, 2.5);
    ctx.restore();

    // Шия и глава
    ctx.fillStyle = C.body;
    ell(38, -45, 9, 13, -0.35);
    rrect(31, -67, 29, 21, [11, 12, 9, 9]);
    ctx.fillStyle = C.belly;
    ell(47, -48, 10, 2.8);

    eye(45, -60, 5.2);
    ctx.fillStyle = C.dark;
    circle(56, -61, 1.2);
    ctx.fillStyle = C.cheek;
    ell(46, -52, 3, 2);
    mouth(49, -52, 54, -49, 58, -52);
  }

  function drawDinoDuck(back, front) {
    ctx.fillStyle = C.dark;
    legDuck(20, back);

    ctx.fillStyle = C.body;
    ctx.beginPath();
    ctx.moveTo(14, -22);
    ctx.quadraticCurveTo(-2, -22, -10, -28);
    ctx.quadraticCurveTo(-2, -10, 16, -8);
    ctx.closePath();
    ctx.fill();

    spikes([[4, -24, 3], [13, -28, 4], [22, -30, 4.5], [31, -31, 4.5], [40, -30, 4]]);

    ctx.fillStyle = C.body;
    ell(32, -18, 24, 12);

    ctx.fillStyle = 'rgba(46, 120, 30, 0.55)';
    ell(20, -23, 3, 2);
    ell(29, -26, 2.5, 1.8);
    ell(14, -17, 2, 1.5);

    ctx.fillStyle = C.belly;
    ell(36, -12, 15, 6);

    ctx.fillStyle = C.body;
    legDuck(36, front);

    rrect(50, -30, 28, 19, [10, 11, 8, 8]);
    ctx.fillStyle = C.belly;
    ell(66, -13, 10, 2.6);

    eye(63, -23, 4.6);
    ctx.fillStyle = C.dark;
    circle(74, -24, 1.1);
    ctx.fillStyle = C.cheek;
    ell(64, -16, 2.8, 1.8);
    mouth(67, -15, 72, -13, 76, -16);
  }

  function drawDino() {
    // Сянка
    const k = Math.max(0.35, 1 - (-dino.y) / 160);
    ctx.fillStyle = `rgba(40, 25, 10, ${0.22 * k})`;
    ell(dino.x + (dino.ducking ? 38 : 28), GROUND_Y + 3, 22 * k, 3.5 * k);

    let back = 0;
    let front = 0;
    const moving = (game.state === 'playing' || game.state === 'paused') && !dino.dead;
    if (moving) {
      if (!dino.onGround) {
        front = 6;
      } else {
        const ph = Math.floor(dino.runT) % 2;
        back = ph ? 6 : 0;
        front = ph ? 0 : 6;
      }
    }

    ctx.save();
    ctx.translate(dino.x, GROUND_Y + dino.y);
    if (dino.ducking) drawDinoDuck(back, front);
    else drawDinoStand(back, front);
    ctx.restore();
  }

  const HB_STAND = [[14, -44, 28, 26], [34, -64, 22, 16], [16, -18, 18, 16]];
  const HB_DUCK = [[10, -28, 64, 26]];

  // ================== ПРЕПЯТСТВИЯ ==================
  function drawRock() {
    const g = ctx.createLinearGradient(0, -24, 0, 0);
    g.addColorStop(0, '#b8bdc6');
    g.addColorStop(1, '#6d727c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(2, -12);
    ctx.quadraticCurveTo(5, -23, 15, -24);
    ctx.quadraticCurveTo(27, -25, 31, -14);
    ctx.lineTo(34, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(40, 40, 50, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(19, -18);
    ctx.lineTo(22, -11);
    ctx.lineTo(19, -5);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ell(10, -16, 5, 2.5, -0.5);
    ctx.fillStyle = '#6fc23b';
    ell(16, -22.5, 9, 3);
    ctx.fillStyle = '#8fdc55';
    ell(13, -23.5, 4, 1.4);
  }

  function drawStump() {
    ctx.fillStyle = '#8b5a2b';
    ctx.beginPath();
    ctx.moveTo(-2, 0);
    ctx.quadraticCurveTo(4, -3, 5, -10);
    ctx.lineTo(5, -32);
    ctx.lineTo(25, -32);
    ctx.lineTo(25, -10);
    ctx.quadraticCurveTo(26, -3, 32, 0);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#5e3a1a';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(10, -28); ctx.lineTo(10, -6);
    ctx.moveTo(16, -30); ctx.lineTo(16, -4);
    ctx.moveTo(21, -26); ctx.lineTo(21, -8);
    ctx.stroke();

    ctx.fillStyle = '#e3ad6c';
    ell(15, -32, 10, 3.6);
    ctx.strokeStyle = '#b5783d';
    ctx.lineWidth = 1;
    ellStroke(15, -32, 6, 2);
    ellStroke(15, -32, 2.8, 1);

    // Гъбка
    ctx.fillStyle = '#fff2e0';
    rrect(25, -10, 3, 8, 1);
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.ellipse(26.5, -10, 6, 4.5, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    circle(24.5, -12, 0.9);
    circle(28.5, -11.5, 0.9);
  }

  function drawTree() {
    ctx.fillStyle = '#7a4a24';
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.quadraticCurveTo(17, -4, 17, -12);
    ctx.lineTo(17, -46);
    ctx.lineTo(27, -46);
    ctx.lineTo(27, -12);
    ctx.quadraticCurveTo(27, -4, 31, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5a3418';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(21, -40); ctx.lineTo(21, -8);
    ctx.stroke();

    ctx.fillStyle = '#2f8a3a';
    circle(22, -58, 19);
    circle(8, -51, 12);
    circle(36, -51, 12);
    ctx.fillStyle = '#45ad45';
    circle(22, -64, 14);
    circle(12, -57, 9);
    circle(32, -58, 9);
    ctx.fillStyle = '#7cd65a';
    circle(17, -69, 5.5);
    circle(29, -63, 3.5);

    ctx.fillStyle = '#ff8c42';
    circle(11, -48, 2.6);
    circle(31, -53, 2.6);
    circle(23, -45, 2.6);
  }

  function drawFern() {
    const bx = 29;
    const fronds = [[-2.85, 24], [-2.45, 28], [-2.0, 30], [-1.57, 31], [-1.15, 30], [-0.7, 28], [-0.3, 24]];
    fronds.forEach(([a, L], i) => {
      ctx.fillStyle = i % 2 ? '#2e9a45' : '#47c25a';
      ell(bx + Math.cos(a) * L * 0.5, Math.sin(a) * L * 0.5, L * 0.5, 4.6, a);
      ctx.strokeStyle = 'rgba(20, 70, 30, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(bx, 0);
      ctx.lineTo(bx + Math.cos(a) * L * 0.95, Math.sin(a) * L * 0.95);
      ctx.stroke();
    });
    ctx.fillStyle = '#ff6fa8';
    circle(14, -14, 2.4);
    circle(44, -17, 2.4);
    ctx.fillStyle = '#ffe066';
    circle(14, -14, 1);
    circle(44, -17, 1);
  }

  function drawEgg(x, y, rx, ry, c1, c2) {
    ctx.fillStyle = c1;
    ell(x, y, rx, ry);
    ctx.fillStyle = c2;
    circle(x - rx * 0.3, y - ry * 0.2, 1.6);
    circle(x + rx * 0.35, y + ry * 0.25, 1.3);
    circle(x + rx * 0.1, y - ry * 0.55, 1.1);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ell(x - rx * 0.35, y - ry * 0.35, rx * 0.25, ry * 0.18, -0.5);
  }

  function drawEggs() {
    ctx.fillStyle = '#b88a3e';
    ell(21, -3, 22, 5);
    drawEgg(21, -15, 9, 12, '#fff1d6', '#6cc2a0');
    drawEgg(10, -11, 8, 10, '#ffe3c2', '#f08a5d');
    drawEgg(32, -11, 8, 10, '#e9f6ff', '#8a7ad8');
    ctx.strokeStyle = '#e0b85c';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(2, -3); ctx.lineTo(12, -1);
    ctx.moveTo(16, -1); ctx.lineTo(28, -3);
    ctx.moveTo(30, -1); ctx.lineTo(41, -3);
    ctx.stroke();
  }

  function drawPtero(o) {
    const up = Math.floor(o.anim * 7) % 2 === 0;

    ctx.fillStyle = '#9b5de5';
    ctx.beginPath();
    ctx.moveTo(39, -18);
    ctx.lineTo(53, -15);
    ctx.lineTo(39, -14);
    ctx.closePath();
    ctx.fill();
    ell(28, -17, 13, 6);
    ctx.fillStyle = '#d6b4ff';
    ell(29, -14.5, 8, 2.5);

    ctx.fillStyle = '#ff6f61';
    ctx.beginPath();
    ctx.moveTo(16, -21);
    ctx.lineTo(30, -28);
    ctx.lineTo(20, -17);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#9b5de5';
    ell(14, -19, 7, 5);
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.moveTo(9, -21);
    ctx.lineTo(-3, -17);
    ctx.lineTo(9, -15.5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fff';
    circle(13, -20.5, 2);
    ctx.fillStyle = '#1d1d2b';
    circle(12.4, -20.5, 1.1);

    ctx.fillStyle = '#c39bff';
    ctx.strokeStyle = '#7b3fb8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (up) {
      ctx.moveTo(20, -19);
      ctx.quadraticCurveTo(24, -32, 38, -36);
      ctx.quadraticCurveTo(33, -25, 37, -18);
    } else {
      ctx.moveTo(20, -15);
      ctx.quadraticCurveTo(24, -4, 38, 0);
      ctx.quadraticCurveTo(33, -9, 37, -16);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  const KINDS = {
    rock:    { w: 34, hit: [[4, -20, 26, 20]], draw: drawRock },
    rockBig: { w: 34, hit: [[4, -20, 26, 20]], draw: drawRock, scale: [1.35, 1.5] },
    stump:   { w: 30, hit: [[5, -33, 20, 33]], draw: drawStump },
    tree:    { w: 44, hit: [[17, -42, 10, 42], [6, -76, 32, 36]], draw: drawTree, scale: [0.82, 1.0] },
    fern:    { w: 58, hit: [[10, -24, 38, 24]], draw: drawFern },
    eggs:    { w: 42, hit: [[4, -24, 34, 24]], draw: drawEggs },
    ptero:   { w: 54, hit: [[4, -24, 42, 12]], draw: drawPtero, fly: true }
  };

  function makeObstacle(kind, x) {
    const k = KINDS[kind];
    const s = k.scale ? rand(k.scale[0], k.scale[1]) : 1;
    const o = { kind, k, x, s, w: k.w * s, yb: GROUND_Y + 2, vx: 0, anim: Math.random() };
    if (k.fly) {
      // ниско = скачай, средно = навеждай се, високо = мини отдолу
      const r = Math.random();
      const lift = r < 0.35 ? 6 : r < 0.75 ? 30 : 66;
      o.yb = GROUND_Y - lift;
      o.vx = 45;
    }
    return o;
  }

  function pickKind() {
    const pool = [['rock', 3], ['rockBig', 2], ['stump', 2], ['tree', 2], ['fern', 2], ['eggs', 1.2]];
    if (game.score >= PTERO_FROM) pool.push(['ptero', 2.2]);
    let total = 0;
    for (const p of pool) total += p[1];
    let r = Math.random() * total;
    for (const [name, wgt] of pool) {
      if ((r -= wgt) <= 0) return name;
    }
    return 'rock';
  }

  function spawn() {
    const kind = pickKind();
    const first = makeObstacle(kind, W + 30);
    obstacles.push(first);
    let width = first.w;

    // Понякога две препятствия едно до друго
    const small = kind === 'rock' || kind === 'stump' || kind === 'eggs';
    if (small && game.speed > 480 && Math.random() < 0.25) {
      const second = makeObstacle(Math.random() < 0.5 ? 'rock' : 'stump', first.x + first.w + rand(2, 10));
      obstacles.push(second);
      width += second.w + 10;
    }

    game.nextGap = width + game.speed * rand(0.75, 1.45) + 140;
  }

  function drawObstacle(o) {
    if (o.k.fly) {
      ctx.fillStyle = 'rgba(40, 25, 10, 0.12)';
      ell(o.x + o.w / 2, GROUND_Y + 3, 16, 3);
    } else {
      ctx.fillStyle = 'rgba(40, 25, 10, 0.22)';
      ell(o.x + o.w / 2, GROUND_Y + 3, o.w * 0.55, 3.5);
    }
    ctx.save();
    ctx.translate(o.x, o.yb);
    ctx.scale(o.s, o.s);
    o.k.draw(o);
    ctx.restore();
  }

  // ================== СБЛЪСЪЦИ ==================
  function hitTest() {
    const base = GROUND_Y + dino.y;
    const boxes = (dino.ducking ? HB_DUCK : HB_STAND).map((r) => [dino.x + r[0], base + r[1], r[2], r[3]]);
    for (const o of obstacles) {
      if (o.x > dino.x + 90 || o.x + o.w < dino.x) continue;
      for (const h of o.k.hit) {
        const bx = o.x + h[0] * o.s;
        const by = o.yb + h[1] * o.s;
        const bw = h[2] * o.s;
        const bh = h[3] * o.s;
        for (const a of boxes) {
          if (a[0] < bx + bw && a[0] + a[2] > bx && a[1] < by + bh && a[1] + a[3] > by) return true;
        }
      }
    }
    return false;
  }

  // ================== ЧАСТИЦИ (прах) ==================
  function dust(x, y, n, vxMin, vxMax) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x: x + rand(-6, 6), y,
        vx: rand(vxMin, vxMax), vy: rand(-70, -15),
        life: 0, max: rand(0.3, 0.6), r: rand(1.5, 3.5)
      });
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 200 * dt;
    }
    particles = particles.filter((p) => p.life < p.max);
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.fillStyle = `rgba(190, 140, 90, ${0.7 * (1 - p.life / p.max)})`;
      circle(p.x, p.y, p.r);
    }
  }

  // ================== ТОЧКИ / ИНТЕРФЕЙС ==================
  function refreshHud() {
    scoreEl.textContent = pad(game.score);
    bestEl.textContent = pad(Math.max(game.best, game.score));
    bestBox.classList.toggle('beaten', game.state === 'playing' && game.best > 0 && game.score > game.best);
  }

  function flashScore() {
    scoreBox.classList.remove('flash');
    void scoreBox.offsetWidth;
    scoreBox.classList.add('flash');
  }

  function showScreen(name) {
    for (const key in screens) screens[key].classList.toggle('show', key === name);
  }

  // ================== ХОД НА ИГРАТА ==================
  function startGame() {
    if (game.state === 'playing') return;
    if (game.state === 'over' && performance.now() < game.canRestartAt) return;

    obstacles = [];
    particles = [];
    game.speed = START_SPEED;
    game.distance = 0;
    game.score = 0;
    game.milestone = 0;
    game.shake = 0;
    game.nextGap = Math.max(420, W * 0.6);
    Object.assign(dino, { y: 0, vy: 0, onGround: true, ducking: false, dead: false, runT: 0 });
    input.down = false;
    input.jumpBuffer = 0;

    game.state = 'playing';
    showScreen(null);
    pauseBtn.hidden = false;
    refreshHud();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function gameOver() {
    game.state = 'over';
    dino.dead = true;
    dino.ducking = false;
    game.shake = 0.35;
    dust(dino.x + 30, GROUND_Y - 2, 12, -120, 120);

    const isNew = game.score > game.best;
    if (isNew) {
      game.best = game.score;
      saveBest(game.best);
    }
    finalScoreEl.textContent = pad(game.score);
    finalBestEl.textContent = pad(game.best);
    newRecordEl.hidden = !isNew;
    pauseBtn.hidden = true;
    refreshHud();

    game.canRestartAt = performance.now() + 600;
    setTimeout(() => {
      if (game.state === 'over') showScreen('over');
    }, 450);
  }

  function pause() {
    if (game.state !== 'playing') return;
    game.state = 'paused';
    input.down = false;
    input.jumpHeld = false;
    showScreen('pause');
  }

  function resume() {
    if (game.state !== 'paused') return;
    game.state = 'playing';
    showScreen(null);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function step(dt) {
    game.speed = Math.min(maxSpeed, game.speed + ACCEL * dt);
    const dx = game.speed * dt;
    game.offset += dx;
    game.distance += dx;

    const sc = Math.floor(game.distance / SCORE_DIV);
    if (sc !== game.score) {
      game.score = sc;
      const m = Math.floor(sc / 100);
      if (m > game.milestone) {
        game.milestone = m;
        flashScore();
      }
      refreshHud();
    }

    // Скок (с малък буфер, за да се усеща отзивчиво)
    if (input.jumpBuffer > 0) {
      input.jumpBuffer -= dt;
      if (dino.onGround && !input.down) {
        dino.vy = input.jumpHeld ? JUMP_V : MIN_JUMP_V;
        dino.onGround = false;
        input.jumpBuffer = 0;
      }
    }

    if (!dino.onGround) {
      dino.vy += GRAVITY * dt;
      if (input.down && dino.vy < FAST_FALL_V) dino.vy = FAST_FALL_V;
      dino.y += dino.vy * dt;
      if (dino.y >= 0) {
        dino.y = 0;
        dino.vy = 0;
        dino.onGround = true;
        dust(dino.x + 24, GROUND_Y - 1, 6, -90, 30);
      }
    }
    dino.ducking = input.down && dino.onGround;
    dino.runT += dt * game.speed / 42;

    dino.dustT -= dt;
    if (dino.onGround && dino.dustT <= 0) {
      dino.dustT = 0.09;
      dust(dino.x + 14, GROUND_Y - 1, 1, -game.speed * 0.35, -game.speed * 0.15);
    }

    // Препятствия
    for (const o of obstacles) {
      o.x -= (game.speed + o.vx) * dt;
      o.anim += dt;
    }
    obstacles = obstacles.filter((o) => o.x + o.w > -60);

    game.nextGap -= dx;
    if (game.nextGap <= 0) spawn();

    if (hitTest()) gameOver();
  }

  function update(dt) {
    game.time += dt;

    // Мигане
    if (dino.blink > 0) {
      dino.blink -= dt;
    } else {
      dino.blinkTimer -= dt;
      if (dino.blinkTimer <= 0) {
        dino.blink = 0.13;
        dino.blinkTimer = rand(2, 5);
      }
    }

    if (game.shake > 0) game.shake = Math.max(0, game.shake - dt);

    if (game.state === 'playing') {
      // Малки стъпки, за да няма "прескачане" през препятствия
      const n = Math.max(1, Math.ceil(dt / 0.008));
      const h = dt / n;
      for (let i = 0; i < n && game.state === 'playing'; i++) step(h);
    }

    if (game.state !== 'paused') updateParticles(dt);
  }

  function render() {
    ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    ctx.translate(0, topPad);
    if (game.shake > 0) {
      const m = game.shake * 14;
      ctx.translate(rand(-m, m), rand(-m, m));
    }
    drawSky();
    drawClouds();
    drawVolcanoes();
    drawMountains();
    drawJungle();
    drawGround();
    for (const o of obstacles) drawObstacle(o);
    drawParticles();
    drawDino();
  }

  let lastTs = performance.now();
  function frame(ts) {
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.05) dt = 0.05;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // ================== УПРАВЛЕНИЕ ==================
  function pressJump() {
    if (game.state === 'menu' || game.state === 'over') {
      startGame();
      return;
    }
    if (game.state !== 'playing') return;
    input.jumpHeld = true;
    input.jumpBuffer = 0.13;
  }

  function releaseJump() {
    input.jumpHeld = false;
    if (!dino.onGround && dino.vy < MIN_JUMP_V) dino.vy = MIN_JUMP_V;
  }

  function pressDown() {
    if (game.state !== 'playing') return;
    input.down = true;
  }

  function releaseDown() {
    input.down = false;
  }

  const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'];
  const DOWN_KEYS = ['ArrowDown', 'KeyS'];

  window.addEventListener('keydown', (e) => {
    const k = e.code;
    if (JUMP_KEYS.includes(k)) {
      e.preventDefault();
      if (e.repeat) return;
      if (game.state === 'paused') resume();
      else pressJump();
    } else if (DOWN_KEYS.includes(k)) {
      e.preventDefault();
      pressDown();
    } else if (k === 'KeyP' || k === 'Escape') {
      if (game.state === 'playing') pause();
      else if (game.state === 'paused') resume();
    } else if (k === 'Enter' && game.state !== 'playing') {
      e.preventDefault();
      if (game.state === 'paused') resume();
      else startGame();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (JUMP_KEYS.includes(e.code)) releaseJump();
    else if (DOWN_KEYS.includes(e.code)) releaseDown();
  });

  // Докосване / мишка: докосване = скок, плъзгане надолу = навеждане
  let ptr = null;
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    ptr = { id: e.pointerId, y: e.clientY, ducked: false };
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* игнорирай */ }
    }
    pressJump();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!ptr || e.pointerId !== ptr.id || ptr.ducked) return;
    if (e.clientY - ptr.y > 24) {
      ptr.ducked = true;
      releaseJump();
      pressDown();
    }
  });

  function endPointer(e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    if (ptr.ducked) releaseDown();
    releaseJump();
    ptr = null;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  screens.start.addEventListener('click', startGame);
  screens.over.addEventListener('click', startGame);
  screens.pause.addEventListener('click', resume);

  pauseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (game.state === 'playing') pause();
    else if (game.state === 'paused') resume();
  });

  // Автоматична пауза, ако излезеш от раздела
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  window.addEventListener('blur', pause);

  // ================== СТАРТ ==================
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  window.addEventListener('resize', resize);
  resize();
  refreshHud();
  requestAnimationFrame(frame);
})();
