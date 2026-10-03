/* Hero: an abstract 3D "columnar file" drawn on a 2D canvas (no library).
   X axis = columns, Y = rows inside a row group, Z = row groups.
   Phases mirror Section 6.8: projection → row-group pruning → decoded RecordBatch. */
"use strict";

(function () {
  const canvas = document.getElementById("hero3d");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const caption = document.getElementById("stageCaption");
  const phaseButtons = document.querySelectorAll(".stage-steps button");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const COLS = 5, ROWS = 4, GROUPS = 4;
  const KEPT_COLS = new Set([1, 3]);   // columns the query selects
  const KEPT_GROUPS = new Set([1, 3]); // row groups whose min/max can match
  const CUBE = 0.78, GAP = 1.0;
  const CAPTIONS = [
    "<b>Dữ liệu cột</b>: 5 cột × 4 row group trong tệp Parquet",
    "<b>Projection pushdown</b>: chỉ giữ 2 cột truy vấn cần",
    "<b>Pruning</b>: bỏ row group có min/max không khớp điều kiện",
    "<b>Late materialization</b>: giải mã phần còn lại thành RecordBatch"
  ];
  const AUTO_MS = 3200, USER_PAUSE_MS = 9000, DRAG_SENSITIVITY = 0.008;

  let palette = readPalette();
  let phase = 0, lastSwitch = 0, pausedUntil = 0;
  let yaw = -0.65, pitch = 0.42, autoSpin = true;
  let dragging = false, lastX = 0, lastY = 0;
  let visible = true, rafId = 0;
  let viewW = 0, viewH = 0; // cached CSS size: reading clientWidth every frame forces a reflow

  const cubes = [];
  for (let x = 0; x < COLS; x++)
    for (let y = 0; y < ROWS; y++)
      for (let z = 0; z < GROUPS; z++)
        cubes.push({ x, y, z, alpha: 1, lift: 0, glow: 0 });

  function readPalette() {
    const s = getComputedStyle(document.documentElement);
    const v = (name) => s.getPropertyValue(name).trim();
    return { cols: [v("--ink-3"), v("--green"), v("--blue"), v("--ink-2"), v("--red")], hl: v("--hl"), bg: v("--bg") };
  }

  function targetFor(c) {
    const colKept = KEPT_COLS.has(c.x), groupKept = KEPT_GROUPS.has(c.z);
    if (phase === 0) return { alpha: 1, lift: 0, glow: 0 };
    if (phase === 1) return { alpha: colKept ? 1 : 0.1, lift: 0, glow: 0 };
    if (phase === 2) return { alpha: colKept && groupKept ? 1 : 0.07, lift: 0, glow: 0 };
    return { alpha: colKept && groupKept ? 1 : 0.04, lift: colKept && groupKept ? 1.6 : 0, glow: colKept && groupKept ? 1 : 0 };
  }

  function setPhase(p, fromUser) {
    phase = p;
    lastSwitch = performance.now();
    if (fromUser) pausedUntil = lastSwitch + USER_PAUSE_MS;
    caption.innerHTML = CAPTIONS[p];
    phaseButtons.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.phase) === p)));
    if (reduceMotion.matches) { cubes.forEach((c) => Object.assign(c, targetFor(c))); draw(); }
  }

  function resize(entries) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const box = entries && entries[0] ? entries[0].contentRect : canvas.getBoundingClientRect();
    const w = Math.round(box.width), h = Math.round(box.height);
    if (!w || !h) return;
    viewW = w; viewH = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  // Unit cube corners and faces (indices into corners) with outward normals.
  const CORNERS = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
  const FACES = [
    { v: [0,1,2,3], n: [0,0,-1] }, { v: [5,4,7,6], n: [0,0,1] },
    { v: [4,0,3,7], n: [-1,0,0] }, { v: [1,5,6,2], n: [1,0,0] },
    { v: [3,2,6,7], n: [0,1,0] }, { v: [4,5,1,0], n: [0,-1,0] }
  ];

  function rotate(p) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x1 = p[0] * cy - p[2] * sy, z1 = p[0] * sy + p[2] * cy;
    const y2 = p[1] * cp - z1 * sp, z2 = p[1] * sp + z1 * cp;
    return [x1, y2, z2];
  }

  function shade(hex, k) {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
    if (!m) return hex;
    const ch = (i) => Math.max(0, Math.min(255, Math.round(parseInt(m[i], 16) * k)));
    return `rgb(${ch(1)},${ch(2)},${ch(3)})`;
  }

  function draw() {
    const w = viewW, h = viewH;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    const scale = Math.min(w, h) / 9.5, cx = w / 2, cy = h * 0.47, dist = 15;
    const light = [-0.4, -0.7, -0.6];
    const items = [];
    for (const c of cubes) {
      if (c.alpha < 0.02) continue;
      const wx = (c.x - (COLS - 1) / 2) * GAP * 1.25;
      const wy = (c.y - (ROWS - 1) / 2) * GAP - c.lift * (c.z - 1.5) * 0.1 - c.lift;
      const wz = (c.z - (GROUPS - 1) / 2) * GAP * 1.55 * (1 - c.lift * 0.32);
      const pts = CORNERS.map((k) => rotate([wx + k[0] * CUBE / 2, wy + k[1] * CUBE / 2, wz + k[2] * CUBE / 2]));
      const center = rotate([wx, wy, wz]);
      items.push({ c, pts, depth: center[2] });
    }
    items.sort((a, b) => b.depth - a.depth);
    for (const it of items) {
      const base = it.c.glow > 0.5 ? palette.hl : palette.cols[it.c.x % palette.cols.length];
      const proj = it.pts.map((p) => { const f = dist / (dist + p[2]); return [cx + p[0] * scale * f, cy + p[1] * scale * f]; });
      ctx.globalAlpha = it.c.alpha;
      for (const face of FACES) {
        const n = rotate(face.n);
        if (n[2] > 0) continue; // facing away from the viewer
        const lambert = 0.62 + 0.38 * Math.max(0, -(n[0] * light[0] + n[1] * light[1] + n[2] * light[2]));
        ctx.beginPath();
        face.v.forEach((vi, i) => (i ? ctx.lineTo(proj[vi][0], proj[vi][1]) : ctx.moveTo(proj[vi][0], proj[vi][1])));
        ctx.closePath();
        ctx.fillStyle = shade(base, lambert);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,.18)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function tick(now) {
    rafId = 0;
    if (!visible) return;
    if (!reduceMotion.matches && now > pausedUntil && now - lastSwitch > AUTO_MS) setPhase((phase + 1) % 4, false);
    if (autoSpin && !dragging && !reduceMotion.matches) yaw += 0.0035;
    const k = 0.08;
    for (const c of cubes) {
      const t = targetFor(c);
      c.alpha += (t.alpha - c.alpha) * k;
      c.lift += (t.lift - c.lift) * k;
      c.glow += (t.glow - c.glow) * k;
    }
    draw();
    if (!reduceMotion.matches) rafId = requestAnimationFrame(tick);
  }

  function start() { if (!rafId && !reduceMotion.matches) rafId = requestAnimationFrame(tick); }

  canvas.addEventListener("pointerdown", (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * DRAG_SENSITIVITY;
    pitch = Math.max(-1.2, Math.min(1.2, pitch + (e.clientY - lastY) * DRAG_SENSITIVITY));
    lastX = e.clientX; lastY = e.clientY;
    if (reduceMotion.matches) draw();
  });
  const endDrag = () => { dragging = false; };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  phaseButtons.forEach((b) => b.addEventListener("click", () => setPhase(Number(b.dataset.phase), true)));

  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) start();
  }).observe(canvas);
  new ResizeObserver(resize).observe(canvas);
  window.addEventListener("df-theme-change", () => { palette = readPalette(); draw(); });
  reduceMotion.addEventListener("change", () => { cubes.forEach((c) => Object.assign(c, targetFor(c))); draw(); start(); });

  setPhase(0, false);
  resize();
  if (reduceMotion.matches) { cubes.forEach((c) => Object.assign(c, targetFor(c))); draw(); }
  start();
})();
