"use strict";
// ================= Canvas / visuals =================
const cvs = els.viz; let ctx = cvs.getContext('2d');   // ctx is reassignable: render() briefly redirects it to offscreen layers so the scenery foreground can occlude particles
let W = 0, H = 0, cx = 0, cy = 0, baseR = 180;
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth; H = window.innerHeight;
  cvs.width = W * dpr; cvs.height = H * dpr; cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // keep the reactive ring's peaks above the bottom controls
  baseR = Math.max(110, Math.min(Math.min(W, H) * 0.26, (H / 2 - 150) / 1.5, 290));
  lastFitLen = -1; fitTime(els.time.textContent);
}
window.addEventListener('resize', resize);
let lastFitLen = -1;
// Shrink the timer text so it stays inside the ring when it's wide (e.g. 3-digit minutes like 179:54).
function fitTime(text) {
  if (text == null || text.length === lastFitLen) return;   // only re-measure when the width changes
  lastFitLen = text.length;
  els.time.style.fontSize = '';                              // reset to the CSS clamp size
  const avail = baseR * 1.6;                                 // ~80% of the ring's diameter
  const w = els.time.scrollWidth;
  if (avail > 0 && w > avail) {
    const base = parseFloat(getComputedStyle(els.time).fontSize) || 100;
    els.time.style.fontSize = (base * avail / w).toFixed(1) + 'px';
  }
}
function layoutCenter() { const r = els.centerText.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; }

const circle = { mode: 'hidden', t0: 0, dur: 0, amount: 0 };
function drawIn(dur)  { circle.mode = 'drawIn';  circle.t0 = perf(); circle.dur = dur; }
function drawOut(dur) { circle.mode = 'drawOut'; circle.t0 = perf(); circle.dur = dur; }
function setFull()    { circle.mode = 'full'; circle.amount = 1; }
function hideCircle() { circle.mode = 'hidden'; circle.amount = 0; }
function updateCircle(now) {
  if (circle.mode === 'drawIn')  { const p = (now - circle.t0) / circle.dur; if (p >= 1) { circle.amount = 1; circle.mode = 'full'; } else circle.amount = easeOutCubic(p); }
  else if (circle.mode === 'drawOut') { const p = (now - circle.t0) / circle.dur; if (p >= 1) { circle.amount = 0; circle.mode = 'hidden'; } else circle.amount = 1 - easeInOutCubic(p); }
  else if (circle.mode === 'full') circle.amount = 1; else circle.amount = 0;
}

const ripples = [], particles = [];
let vizAmp = 0;                                  // 0..1 — how "open" the reactive waveform is (eases for smooth pause/resume)
let vizLevelEnv = 0;                             // enveloped reactive energy: snaps up on beats, eases down (the "pop")
const vizMult = () => (settings.vizIntensity || 0) / 50;   // 0..2, default 1.4

// A "water ripple" = a short train of soft, gently-undulating concentric rings expanding outward.
function spawnRipple(strength) {
  const count = strength >= 0.9 ? 4 : 2, sharp = rippleStyle === 'sharpRipple';
  for (let k = 0; k < count; k++) {
    ripples.push({
      r: baseR - k * 15, speed: 0.40 + 0.30 * strength,
      life: 1000 + 850 * strength, max: 1000 + 850 * strength,
      crest: (sharp ? 8 : 5) + (sharp ? 12 : 8) * strength, strength,
      seed: Math.random() * Math.PI * 2,
      lobes: sharp ? 6 + Math.floor(Math.random() * 5) : 3 + Math.floor(Math.random() * 4),   // undulations → "distortion"
      style: rippleStyle
    });
  }
}
function spawnParticle(sig, m) {
  const fly = !settings.calmParticles;            // fly-off stream is the default; calm mode fades instead
  const a = Math.random() * Math.PI * 2;
  let spd = (0.05 + 0.30 * sig.intensity) * (0.6 + 0.9 * Math.random()) * (0.7 + 0.6 * m);
  if (fly) spd = spd * 2.0 + 0.22;                 // strong initial burst; it eases down as it travels (see updateParticles)
  const r0 = baseR + 4 + (0.1 + 0.4 * sig.level) * baseR * 0.2, life = 500 + 1000 * Math.random();
  particles.push({ px: Math.cos(a) * r0, py: Math.sin(a) * r0, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life, max: life, size: (1 + 2.6 * Math.random()) * (0.8 + 0.5 * m), fly, seed: Math.random() * Math.PI * 2 });
}
let spawnAcc = 0, lastBurst = 0;
function maybeSpawnParticles(sig, dt, now) {
  const m = vizMult();
  spawnAcc += sig.intensity * (dt / 16) * 1.6 * m;
  while (spawnAcc >= 1) { spawnAcc -= 1; spawnParticle(sig, m); }
  // burst hard on intense moments so you really feel it
  if (sig.intensity > 0.65 && now - lastBurst > 80) { lastBurst = now; const n = Math.round((5 + 14 * sig.intensity) * m); for (let k = 0; k < n; k++) spawnParticle(sig, m); }
  if (particles.length > 900) particles.splice(0, particles.length - 900);
}
function updateParticles(dt) {
  const fr = Math.pow(0.93, dt / 16), mar = 30;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.px += p.vx * dt; p.py += p.vy * dt;
    if (p.fly) {                                   // inertia: fast out, eases down, keeps drifting to the edge (no fade)
      const ffr = Math.pow(0.955, dt / 16);
      p.vx *= ffr; p.vy *= ffr;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp < 0.16) { const k = 0.16 / (sp || 1e-6); p.vx *= k; p.vy *= k; }   // floor speed so it still reaches the edge
      const sx = cx + p.px, sy = cy + p.py;
      if (sx < -mar || sx > W + mar || sy < -mar || sy > H + mar) particles.splice(i, 1);
    } else {
      p.vx *= fr; p.vy *= fr; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
}
function updateRipples(dt) { for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.r += r.speed * dt; r.life -= dt; if (r.life <= 0) ripples.splice(i, 1); } }
function modeColor() {
  const light = settings.theme === 'light';
  if (mode === 'work') return light ? [40, 110, 230] : [150, 200, 255];
  return light ? [18, 158, 92] : [150, 255, 190];
}

// ===== Rave / stage lights: rise on sustained intense sections, sweep + strobe, slide back down =====
const rave = { phase: 'off', offset: 100, hype: 0, low: 0, last: -1e9, onStart: 0 };
let raveTest = false;   // settings "test" toggle → force the lights on for preview (transient, not saved)
function resetRave() { rave.phase = 'off'; rave.offset = 100; rave.low = 0; rave.last = -1e9; }
function updateRave(now, dt, sig) {
  rave.hype += (sig.level - rave.hype) * Math.min(1, dt / 700);   // smoothed energy → detects sustained drops
  const cd = (settings.raveCd || 6) * 60000;
  if (rave.phase === 'off') {
    const phaseElapsed = dur(mode) - remainingMs;                 // time since this focus/break phase started
    if (raveTest) { rave.phase = 'rising'; rave.onStart = now; rave.low = 0; }
    else if (settings.rave && PH === 'run' && !retracting && phaseElapsed >= 120000 &&   // not in the first 2 min
             rave.hype > 0.82 && now - rave.last >= cd) {
      rave.phase = 'rising'; rave.last = now; rave.onStart = now; rave.low = 0;
    }
  } else if (rave.phase === 'rising') {
    rave.offset = Math.max(0, rave.offset - dt * 0.16);
    if (rave.offset === 0) rave.phase = 'on';
  } else if (rave.phase === 'on') {
    if (rave.hype < 0.6) rave.low += dt; else rave.low = 0;
    const onTime = now - rave.onStart;                            // hold 10–15s
    if (!raveTest && (PH !== 'run' || !settings.rave || onTime > 15000 || (onTime > 10000 && rave.low > 1500)))
      rave.phase = 'falling';
  } else if (rave.phase === 'falling') {
    rave.offset = Math.min(100, rave.offset + dt * 0.16);
    if (rave.offset === 100) rave.phase = 'off';
  }
}
function renderRave(now, sig) {
  if (rave.phase === 'off' && rave.offset >= 100) return;
  const t = now / 1000, vis = 1 - rave.offset / 100;
  const NF = 7, originY = H - 14 + (rave.offset / 100) * 90;   // simple fixtures at the bottom; slide down when fading
  const skipMid = i => !settings.raveFull && i > 1 && i < NF - 2;   // default: 2 each side (drop the middle 3)
  const beat = vizLevelEnv;
  const S = (resolveColor('strobeColor', now) || [255, 255, 255]).join(',');   // strobe colour shop item (rainbow-aware; default white)
  const bright = clamp01((0.1 + 0.12 * sig.level + 0.7 * beat) * vis);    // dim between beats, flashes on the beat (strobe)
  const len = H * 1.3, hw = 0.075;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';                    // additive → glowing beams that brighten where they cross
  for (let i = 0; i < NF; i++) {
    if (skipMid(i)) continue;
    const fx = (i + 0.5) / NF * W;
    const ang = -Math.PI / 2 + Math.sin(t * 1.6 + i * 0.8) * 0.5;   // sweep back and forth
    const x1 = fx + Math.cos(ang - hw) * len, y1 = originY + Math.sin(ang - hw) * len;
    const x2 = fx + Math.cos(ang + hw) * len, y2 = originY + Math.sin(ang + hw) * len;
    const grad = ctx.createLinearGradient(fx, originY, fx + Math.cos(ang) * len, originY + Math.sin(ang) * len);
    grad.addColorStop(0, `rgba(${S},${bright})`);
    grad.addColorStop(0.45, `rgba(${S},${bright * 0.3})`);
    grad.addColorStop(1, `rgba(${S},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.moveTo(fx, originY); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  for (let i = 0; i < NF; i++) {                               // grey "light machines" + flashing lens
    if (skipMid(i)) continue;
    const fx = (i + 0.5) / NF * W;
    ctx.fillStyle = `rgba(176,180,192,${0.9 * vis})`;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(fx - 15, originY - 9, 30, 18, 4); else ctx.rect(fx - 15, originY - 9, 30, 18);
    ctx.fill();
    ctx.fillStyle = `rgba(${S},${clamp01(0.25 + 0.7 * beat) * vis})`;
    ctx.beginPath(); ctx.arc(fx, originY - 1, 3, 0, Math.PI * 2); ctx.fill();
  }
}
function drawStar(x, y, s) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? s * 0.45 : s; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
  ctx.closePath(); ctx.fill();
}
function drawNote(x, y, s) {
  ctx.save(); ctx.translate(x, y);
  ctx.beginPath(); ctx.ellipse(-s * 0.35, s * 0.5, s * 0.6, s * 0.42, -0.35, 0, Math.PI * 2); ctx.fill();   // note head
  ctx.fillRect(s * 0.15, -s * 0.95, s * 0.22, s * 1.5);                                                     // stem
  ctx.fillRect(s * 0.15, -s * 0.95, s * 0.6, s * 0.26);                                                     // flag
  ctx.restore();
}
function drawNyan(x, y, s, ang) {                                  // tiny Nyan Cat: rainbow trail + pop-tart cat (fixed colours)
  const u = Math.max(2.4, s * 1.5);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); if (Math.cos(ang) < 0) ctx.scale(1, -1);   // flip upright when flying leftish (else 180° rotation = upside down)
  const rb = ['#ff2d2d', '#ff9b1f', '#ffe92b', '#3fe04a', '#2f8bff', '#9b4dff'], bw = u * 0.5;
  for (let i = 0; i < 6; i++) { ctx.fillStyle = rb[i]; ctx.fillRect(-u * 4, -u * 1.5 + i * bw, u * 2.6, bw + 0.5); }   // rainbow trail (behind the head)
  ctx.fillStyle = '#9aa0a6'; ctx.fillRect(-u * 1.5, -u * 1.3, u * 2.7, u * 2.6);                                       // grey body
  ctx.fillStyle = '#ffc4dd'; ctx.fillRect(-u * 1.4, -u * 1.2, u * 1.5, u * 2.4);                                       // pink pop-tart
  ctx.fillStyle = '#222'; ctx.fillRect(u * 0.35, -u * 0.45, u * 0.4, u * 0.4); ctx.fillRect(u * 0.35, u * 0.25, u * 0.4, u * 0.4);   // eyes
  ctx.restore();
}
const nyanImg = new Image(); nyanImg.src = 'nyancat.png';         // real Nyan Cat sprite; content band = sx0,sy412,sw922,sh318
const DUCK_PX = ['..YYY....', '.YYYYY...', '.YYEYYY..', '.YYYYYYOO', 'YYYYYYYY.', 'YYYYYYYY.', '.YYYYYY..', '..YYYY...'];   // Y=body O=beak E=eye
function drawDuck(x, y, s, flip) {                                 // smooth rubber duck (always yellow)
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
  ctx.fillStyle = '#ffd23d';
  ctx.beginPath(); ctx.ellipse(-0.15 * s, 0.45 * s, 1.25 * s, 0.8 * s, 0, 0, Math.PI * 2); ctx.fill();   // body
  ctx.beginPath(); ctx.arc(0.7 * s, -0.5 * s, 0.62 * s, 0, Math.PI * 2); ctx.fill();                     // head
  ctx.fillStyle = '#ff921a'; ctx.beginPath(); ctx.moveTo(1.1 * s, -0.6 * s); ctx.lineTo(1.8 * s, -0.42 * s); ctx.lineTo(1.1 * s, -0.24 * s); ctx.closePath(); ctx.fill();   // beak
  ctx.fillStyle = '#1c1c1c'; ctx.beginPath(); ctx.arc(0.84 * s, -0.62 * s, 0.12 * s, 0, Math.PI * 2); ctx.fill();   // eye
  ctx.restore();
}
function drawDuckPixel(x, y, s, flip) {                            // 8-bit rubber duck
  const px = Math.max(2, s * 0.9), ox = -9 * px / 2, oy = -DUCK_PX.length * px / 2;
  ctx.save(); ctx.translate(x, y); if (flip) ctx.scale(-1, 1);
  for (let r = 0; r < DUCK_PX.length; r++) for (let c = 0; c < 9; c++) {
    const ch = DUCK_PX[r][c]; if (ch === '.') continue;
    ctx.fillStyle = ch === 'O' ? '#ff921a' : ch === 'E' ? '#1c1c1c' : '#ffd23d';
    ctx.fillRect(ox + c * px, oy + r * px, px, px);
  }
  ctx.restore();
}
// ---- Scenery overlays: each scene has a BACK layer (behind particles) + a FRONT layer (over particles) for depth ----
function renderOverlay(layer) {                                   // layer: 'back' (behind particles/ring) | 'front' (in front of particles)
  if (overlayStyle === 'mountainsOverlay') drawMountains(layer);
  else if (overlayStyle === 'forestOverlay') drawForest(layer);
  else if (overlayStyle === 'candylandOverlay') drawCandyland(layer);
}
function ridge(base, amp, col, f1, f2, ph) {                      // one filled mountain range, silhouette down to the bottom edge
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H + 2);
  for (let x = 0; x <= W; x += 10) {
    const m = Math.abs(Math.sin(x * f1 + ph)) * 0.72 + Math.abs(Math.sin(x * f2 + ph * 1.7)) * 0.28;
    ctx.lineTo(x, base - m * amp);
  }
  ctx.lineTo(W, H + 2); ctx.closePath(); ctx.fill();
}
function drawMountains(layer) {                                   // hazy ranges (size unchanged — the reference look): far range behind particles, near range in front
  if (layer === 'front') ridge(H * 0.84, H * 0.18, 'rgb(46,58,98)',          0.0055, 0.0130, 2.3);   // near range → foreground (opaque on its layer; FG_ALPHA fades it over the background)
  else                   ridge(H * 0.74, H * 0.22, 'rgba(92,110,160,0.28)', 0.0040, 0.0095, 0.6);   // far, hazy  → background
}
function pineRow(col, tw, hMin, hMax, step, phase) {              // a pine treeline, bases flush with the bottom edge (no float)
  ctx.fillStyle = col;
  for (let i = 0, x = -tw * 0.5; x < W + tw; x += tw * step, i++) {
    const h = hMin + (hMax - hMin) * Math.abs(Math.sin(i * 1.9 + phase)), w = tw * (0.9 + 0.2 * Math.abs(Math.sin(i * 2.3 + phase)));
    for (let k = 0; k < 3; k++) { const ty = H + 2 - h * k * 0.3, w2 = w * (1 - k * 0.22); ctx.beginPath(); ctx.moveTo(x, ty - h * 0.44); ctx.lineTo(x - w2 / 2, ty); ctx.lineTo(x + w2 / 2, ty); ctx.closePath(); ctx.fill(); }
  }
}
function drawForest(layer) {                                      // pine forest with depth: tall hazy treeline behind (≈ mountain scale), darker near fringe in front
  if (layer === 'front') pineRow('rgb(16,44,28)',       Math.max(40, W / 22), H * 0.22, H * 0.33, 0.72, 1.7);   // near fringe → foreground (opaque on its layer; FG_ALPHA fades it over the background)
  else                   pineRow('rgba(40,78,52,0.38)', Math.max(52, W / 17), H * 0.34, H * 0.48, 0.9,  0.0);   // tall hazy treeline (behind particles)
}
function candyRow(sMin, sMax, gapMul, alpha) {                    // candies sized relative to H (scale with the scene like the mountains); spacing derived from size so they never overlap
  const cols = ['#ff9ecb', '#fff2a8', '#a8e6ff', '#c8a8ff', '#ffc1d6'], g = H, sp = H * sMax * gapMul;
  ctx.save(); ctx.globalAlpha = alpha; ctx.lineCap = 'round';
  for (let i = 0, x = sp * 0.55; x < W + sp; x += sp, i++) {
    const c = cols[i % cols.length], s = H * (sMin + (sMax - sMin) * Math.abs(Math.sin(i * 1.3))), kind = i % 3;
    if (kind === 0) {                                             // lollipop
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = s * 0.2;
      ctx.beginPath(); ctx.moveTo(x, g); ctx.lineTo(x, g - s * 2.6); ctx.stroke();
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, g - s * 3, s, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = s * 0.3;
      ctx.beginPath(); ctx.arc(x, g - s * 3, s * 0.5, 0.5, 4.2); ctx.stroke();
    } else if (kind === 1) {                                      // gumdrop
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, g, s * 1.15, Math.PI, 0); ctx.fill();
    } else {                                                      // candy cane
      ctx.strokeStyle = c; ctx.lineWidth = s * 0.5;
      ctx.beginPath(); ctx.moveTo(x, g); ctx.lineTo(x, g - s * 2); ctx.arc(x + s * 0.6, g - s * 2, s * 0.6, Math.PI, 0); ctx.stroke();
    }
  }
  ctx.restore();
}
function drawCandyland(layer) {                                   // candy field with depth, sized like the mountains: small distant candies behind, big candies in front
  if (layer === 'front') candyRow(0.07,  0.10,  2.5, 1);          // big candies — opaque on the FG layer (FG_ALPHA fades it); tallest lollipops reach ≈0.6H
  else                   candyRow(0.035, 0.055, 2.4, 0.42);       // small distant candies (behind particles)
}
// Foreground display opacity per scene — the FG is drawn OPAQUE onto its own layer (so it fully masks particles), then composited at this alpha so it stays translucent over the background. undefined ⇒ scene has no foreground.
const FG_ALPHA = { mountainsOverlay: 0.52, forestOverlay: 0.6, candylandOverlay: 0.62 };
let pcv = null, pctx = null, fcv = null, fctx = null;                         // offscreen layers: particles + opaque foreground
function ensureLayers() {                                                     // lazy-create / resize the offscreen layers to match the main canvas (incl. dpr transform)
  if (!pcv) { pcv = document.createElement('canvas'); pctx = pcv.getContext('2d'); fcv = document.createElement('canvas'); fctx = fcv.getContext('2d'); }
  if (pcv.width === cvs.width && pcv.height === cvs.height) return;
  const dpr = W ? cvs.width / W : 1;
  for (const [c, c2] of [[pcv, pctx], [fcv, fctx]]) { c.width = cvs.width; c.height = cvs.height; c2.setTransform(dpr, 0, 0, dpr, 0, 0); }
}
function render(now, sig) {
  ensureLayers();
  ctx.clearRect(0, 0, W, H);
  renderOverlay('back');                                                      // scenery background (behind rave/ripples/ring/particles)
  renderRave(now, sig);
  const c = modeColor();
  const circRGB = resolveColor('circleColor', now) || c, partRGB = resolveColor('particleColor', now) || c;
  const rgba  = a => `rgba(${circRGB[0]},${circRGB[1]},${circRGB[2]},${a})`;   // ring
  const rgbaP = a => `rgba(${partRGB[0]},${partRGB[1]},${partRGB[2]},${a})`;   // particles
  const rgbaR = rgba;                                                          // ripples now match the ring colour (ripple customization removed)
  // water ripples: soft undulating concentric crests (style: default smooth / sharp jagged / pixel stepped)
  const PXR = 5;
  for (const rp of ripples) {
    const a = Math.max(0, rp.life / rp.max);
    const distort = rp.crest * (0.45 + 0.55 * a);
    const st = rp.style || 'default';
    ctx.save();
    ctx.shadowBlur = st === 'pixelRipple' ? 0 : 8 * rp.strength; ctx.shadowColor = rgbaR(a * 0.4);
    if (st === 'pixelRipple') ctx.lineJoin = 'miter';
    const M = st === 'default' ? 90 : (st === 'sharpRipple' ? Math.max(8, rp.lobes * 4) : 24);
    ctx.beginPath();
    for (let i = 0; i <= M; i++) {
      const ang = (i / M) * Math.PI * 2, ph = ang * rp.lobes + rp.seed + rp.r * 0.016;
      const off = (st === 'sharpRipple' ? (2 * Math.abs((((ph / Math.PI) % 2) + 2) % 2 - 1) - 1) : Math.sin(ph)) * distort;   // triangle wave → jagged
      let x = cx + Math.cos(ang) * (rp.r + off), y = cy + Math.sin(ang) * (rp.r + off);
      if (st === 'pixelRipple') { x = Math.round(x / PXR) * PXR; y = Math.round(y / PXR) * PXR; }
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    if (st === 'default') { ctx.lineWidth = rp.crest * 1.8; ctx.strokeStyle = rgbaR(a * 0.10 * rp.strength); ctx.stroke(); }   // soft water body (smooth only)
    ctx.lineWidth = (st === 'pixelRipple' ? 2.4 : 1.4) + 1.6 * rp.strength; ctx.strokeStyle = rgbaR(a * 0.6); ctx.stroke();    // bright crest
    ctx.restore();
  }
  if (circle.mode !== 'hidden' && circle.amount > 0) {
    ctx.save(); ctx.shadowBlur = 16; ctx.shadowColor = rgba(0.6);
    const PX = 6;                                               // pixel block size (Pixel Ring item)
    if (pixelCircle) ctx.shadowBlur = 0;                        // crisp blocks, no glow
    if (circle.amount >= 1) {
      const t = now / 1000, m = vizMult(), e = vizLevelEnv;     // e = enveloped energy (pops on beats)
      // heartbeat pulse when not reactive (paused/idle): a low, rhythmic boom..boom..boom (whole circle)
      const beatHz = 0.75, bph = (t * beatHz) % 1, atk = 0.05;
      const boom = bph < atk ? bph / atk : Math.pow(1 - (bph - atk) / (1 - atk), 3);
      const pulse = baseR * 0.04 * boom * (1 - vizAmp);
      const uni = baseR * 0.12 * m * e;                         // whole ring expands on a beat
      const ampW = baseR * 0.22 * m * e;                        // spiky wobble, scaled by beat energy
      const radAt = a => {                                      // waveform fades in/out via vizAmp → morph circle↔waveform
        const w = Math.sin(3 * a + t * 1.2) * 0.5 + Math.sin(5 * a - t * 0.9) * 0.3 + Math.sin(8 * a + t * 1.7) * 0.2;
        return baseR + pulse + vizAmp * (uni + ampW * (0.5 + 0.5 * w));
      };
      if (circleStyle === 'eqRing') {
        // equalizer bars: synthesized per-angle pseudo-spectrum (no real FFT) pumping with beat energy
        const NB = 48, r0 = baseR + 4 + pulse;
        ctx.lineWidth = Math.max(2, 2 * Math.PI * r0 / NB * 0.5); ctx.strokeStyle = rgba(0.85);
        for (let i = 0; i < NB; i++) {
          const a = i / NB * Math.PI * 2 - Math.PI / 2;
          const w = Math.sin(3 * a + t * 1.2) * 0.5 + Math.sin(5 * a - t * 0.9) * 0.3 + Math.sin(8 * a + t * 1.7) * 0.2;
          const r1 = r0 + baseR * 0.05 + baseR * 0.34 * m * e * (0.35 + 0.65 * (0.5 + 0.5 * w));
          ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke();
        }
        ctx.lineWidth = 2; ctx.strokeStyle = rgba(0.28); ctx.beginPath(); ctx.arc(cx, cy, r0, 0, Math.PI * 2); ctx.stroke();
      } else if (circleStyle === 'drumRing') {
        // Drum: a taut skin that bounces on the beat + a rigid hoop with tuning lugs
        const hit = m * e;
        const rimR = baseR + pulse + baseR * 0.05 * hit;          // the rim pops outward when struck
        for (let k = 1; k <= 4; k++) {                            // membrane: concentric vibration rings
          const rr = Math.max(3, rimR * (1 - k * 0.18) + Math.sin(t * 7 - k * 1.1) * baseR * 0.05 * hit);
          ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(0.16 + 0.34 * hit);
          ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.lineWidth = 5; ctx.strokeStyle = rgba(0.92);          // the hoop (drum rim)
        ctx.beginPath(); ctx.arc(cx, cy, rimR, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = rgba(0.45);
        ctx.beginPath(); ctx.arc(cx, cy, rimR + 7, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = rgba(0.85);                               // tuning lugs around the hoop
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.save(); ctx.translate(cx + Math.cos(a) * (rimR + 4), cy + Math.sin(a) * (rimR + 4)); ctx.rotate(a); ctx.fillRect(-2.2, -4.5, 4.4, 9); ctx.restore(); }
      } else if (pixelCircle) {
        ctx.fillStyle = rgba(0.92);
        const steps = Math.max(N, Math.ceil(2 * Math.PI * (baseR + ampW) / (PX * 0.8))), seen = new Set();
        for (let i = 0; i < steps; i++) {
          const a = (i / steps) * Math.PI * 2 - Math.PI / 2, rr = radAt(a);
          const x = Math.round((cx + Math.cos(a) * rr) / PX) * PX, y = Math.round((cy + Math.sin(a) * rr) / PX) * PX;
          const k = x + ',' + y; if (seen.has(k)) continue; seen.add(k);   // collapse overlapping blocks
          ctx.fillRect(x - PX / 2, y - PX / 2, PX, PX);
        }
      } else {
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const a = (i / N) * Math.PI * 2 - Math.PI / 2, rr = radAt(a);
          const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.lineWidth = 2.5; ctx.strokeStyle = rgba(0.9); ctx.stroke();
      }
    } else {
      const top = -Math.PI / 2, bot = Math.PI / 2, sweep = circle.amount * Math.PI;
      if (pixelCircle) {
        ctx.fillStyle = rgba(0.95);
        const place = (a0, a1) => {
          const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) * baseR / (PX * 0.8)));
          for (let i = 0; i <= steps; i++) { const a = a0 + (a1 - a0) * i / steps; const x = Math.round((cx + Math.cos(a) * baseR) / PX) * PX, y = Math.round((cy + Math.sin(a) * baseR) / PX) * PX; ctx.fillRect(x - PX / 2, y - PX / 2, PX, PX); }
        };
        place(top, top + sweep); place(bot, bot + sweep);
      } else {
        ctx.lineWidth = 3; ctx.strokeStyle = rgba(0.95);
        ctx.beginPath(); ctx.arc(cx, cy, baseR, top, top + sweep, false); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, baseR, bot, bot + sweep, false); ctx.stroke();
        for (const ang of [top + sweep, bot + sweep]) { ctx.beginPath(); ctx.arc(cx + Math.cos(ang) * baseR, cy + Math.sin(ang) * baseR, 3.5, 0, Math.PI * 2); ctx.fillStyle = rgba(1); ctx.fill(); }
      }
    }
    ctx.restore();
  }
  const fgA = FG_ALPHA[overlayStyle], mainCtx = ctx;                          // foreground scene that should occlude particles?
  if (fgA !== undefined) { pctx.clearRect(0, 0, W, H); ctx = pctx; }          // redirect particles onto their own layer so the foreground can mask them
  for (const p of particles) {
    const al = p.fly ? 0.8 : (p.life / p.max) * 0.85;
    ctx.fillStyle = rgbaP(al);
    const X = cx + p.px, Y = cy + p.py;
    if (particleStyle === 'pixelParticle') { const G = 4, s = Math.max(G, Math.round(p.size * 1.8 / G) * G); ctx.fillRect(Math.round(X / G) * G - s / 2, Math.round(Y / G) * G - s / 2, s, s); }
    else if (particleStyle === 'starParticle') drawStar(X, Y, p.size * 2.1);
    else if (particleStyle === 'noteParticle') drawNote(X, Y, p.size * 1.9);
    else if (particleStyle === 'nyanParticle') {
      if (nyanImg.complete && nyanImg.naturalWidth) {           // real sprite, cropped to the nyan band, facing its flight direction
        ctx.save(); ctx.globalAlpha = al; ctx.translate(X, Y); ctx.rotate(Math.atan2(p.vy, p.vx)); if (p.vx < 0) ctx.scale(1, -1);   // flip upright when flying leftish (else 180° rotation = upside down)
        const dw = p.size * 13, dh = dw * 0.345; ctx.drawImage(nyanImg, 0, 412, 922, 318, -dw / 2, -dh / 2, dw, dh); ctx.restore();
      } else { ctx.globalAlpha = al; drawNyan(X, Y, p.size, Math.atan2(p.vy, p.vx)); ctx.globalAlpha = 1; }   // fallback until it loads
    }
    else if (particleStyle === 'duckParticle') { ctx.globalAlpha = al; drawDuck(X, Y, p.size * 3.5, p.vx < 0); ctx.globalAlpha = 1; }
    else if (particleStyle === 'pixelDuckParticle') { ctx.globalAlpha = al; drawDuckPixel(X, Y, p.size, p.vx < 0); ctx.globalAlpha = 1; }
    else if (particleStyle === 'fireflyParticle') {              // glowing dot that twinkles in & out
      const tw = 0.18 + 0.82 * Math.abs(Math.sin(now * 0.006 + (p.seed || 0)));
      ctx.fillStyle = rgbaP(al * tw); ctx.shadowBlur = p.size * 3.5; ctx.shadowColor = rgbaP(al * tw * 0.8);
      ctx.beginPath(); ctx.arc(X, Y, p.size * 1.15, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
    else if (particleStyle === 'cometParticle') {               // bright head + fading tail behind its motion
      const sp = Math.hypot(p.vx, p.vy) || 1, tx = -p.vx / sp, ty = -p.vy / sp, len = p.size * 9;
      const grad = ctx.createLinearGradient(X, Y, X + tx * len, Y + ty * len);
      grad.addColorStop(0, rgbaP(al)); grad.addColorStop(1, rgbaP(0));
      ctx.strokeStyle = grad; ctx.lineWidth = p.size * 1.3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + tx * len, Y + ty * len); ctx.stroke();
      ctx.fillStyle = rgbaP(al); ctx.beginPath(); ctx.arc(X, Y, p.size * 0.95, 0, Math.PI * 2); ctx.fill();
    }
    else if (particleStyle === 'twinkleParticle') {            // star that shimmers
      ctx.fillStyle = rgbaP(al * (0.25 + 0.75 * Math.abs(Math.sin(now * 0.007 + (p.seed || 0))))); drawStar(X, Y, p.size * 2.1);
    }
    else { ctx.beginPath(); ctx.arc(X, Y, p.size, 0, Math.PI * 2); ctx.fill(); }
  }
  if (fgA === undefined) return;                                              // no scenery foreground → particles already drawn straight to the main canvas
  ctx = mainCtx;
  fctx.clearRect(0, 0, W, H); ctx = fctx; renderOverlay('front'); ctx = mainCtx;   // opaque foreground silhouette → its own layer (doubles as the occlusion mask)
  pctx.save(); pctx.globalCompositeOperation = 'destination-out'; pctx.drawImage(fcv, 0, 0, W, H); pctx.restore();   // erase particles wherever the foreground covers them (opaque to particles)
  mainCtx.drawImage(pcv, 0, 0, W, H);                                         // composite the now-occluded particle layer over the scene
  mainCtx.save(); mainCtx.globalAlpha = fgA; mainCtx.drawImage(fcv, 0, 0, W, H); mainCtx.restore();   // foreground, translucent over the background
}
