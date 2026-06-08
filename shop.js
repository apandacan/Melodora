"use strict";
// ================= Coins / gamification =================
// Lifetime coins + progress toward the every-3-sessions bonus. Lives in its own localStorage key,
// so it survives refreshes and is NEVER wiped by Reset/Start — only finishing a focus phase changes it.
// Skipping bypasses this entirely (see frame()), so coins can't be farmed by skipping.
const GKEY = 'melodora.coins';
const SESSION_COINS = 100, BONUS_COINS = 500, BONUS_EVERY = 4;   // +100 per focus session, +500 boost on every 4th
function loadGame() {
  let r = null; try { r = JSON.parse(localStorage.getItem(GKEY)); } catch {}
  const g = { coins: 0, sessions: 0, totalSessions: 0, owned: {}, equipped: {}, ...(r && typeof r === 'object' ? r : {}) };
  g.coins = Number(g.coins) || 0;
  g.sessions = ((Number(g.sessions) || 0) % BONUS_EVERY + BONUS_EVERY) % BONUS_EVERY;   // keep it 0..3
  g.totalSessions = Number(g.totalSessions) || 0;                     // lifetime focus completions → milestones
  if (!g.owned || typeof g.owned !== 'object') g.owned = {};
  const e = (g.equipped && typeof g.equipped === 'object') ? g.equipped : {};
  g.equipped = {                                                       // slot-based; migrate older {particle,circle,font}
    particleShape: e.particleShape || e.particle || 'default', particleColor: e.particleColor || 'default',
    circleShape:   e.circleShape   || e.circle   || 'default', circleColor:   e.circleColor   || 'default',
    rippleShape:   e.rippleShape   || 'default',                      rippleColor:  e.rippleColor   || 'default',
    font:          e.font || 'default',                               strobeColor:  e.strobeColor   || 'default',
    theme:         e.theme || 'default',                              background:   e.background    || 'default',
    overlay:       e.overlay || 'default',
  };
  for (const s in g.equipped)                                          // never keep an unowned item equipped (milestones count as owned)
    if (g.equipped[s] !== 'default' && !isOwned(g.equipped[s], g)) g.equipped[s] = 'default';
  return g;
}
function saveGame() { try { localStorage.setItem(GKEY, JSON.stringify(game)); } catch {} }
// top-right coin counter, with a count-up/down tween that eases the shown number toward game.coins
let coinShown = null, coinTweening = false, coinFrom = 0, coinTo = 0, coinT0 = 0, coinDur = 0;
function tickCoins() {
  const p = coinDur > 0 ? Math.min(1, (perf() - coinT0) / coinDur) : 1;
  coinShown = Math.round(coinFrom + (coinTo - coinFrom) * easeOutCubic(p));
  els.coinNum.textContent = coinShown.toLocaleString();
  if (p < 1) requestAnimationFrame(tickCoins);
  else { coinShown = coinTo; els.coinNum.textContent = coinShown.toLocaleString(); coinTweening = false; }
}
function updateCoins(bump) {
  if (coinShown === null) { coinShown = game.coins; els.coinNum.textContent = coinShown.toLocaleString(); }   // first paint = instant
  else if (game.coins !== coinShown) {                                  // retarget the running tween from what's shown now
    coinFrom = coinShown; coinTo = game.coins; coinT0 = perf();
    coinDur = Math.min(900, 220 + Math.abs(coinTo - coinFrom) * 0.5);   // bigger jump → longer count, capped
    if (!coinTweening) { coinTweening = true; requestAnimationFrame(tickCoins); }
  }
  if (bump && els.coins.animate) els.coins.animate(
    [{ transform: 'scale(1)' }, { transform: 'scale(1.16)' }, { transform: 'scale(1)' }],
    { duration: 360, easing: 'ease-out' });
}
// Rising, fading "+100" / "+300" popups, cascaded League-last-hit style.
function floatReward(amount, delayMs) {
  const el = document.createElement('div');
  el.className = 'coin-pop'; el.textContent = '+' + amount;
  el.style.animationDelay = (delayMs || 0) + 'ms';
  el.addEventListener('animationend', () => el.remove());
  els.coinPops.appendChild(el);
}
const floatRewards = amounts => amounts.forEach((a, i) => floatReward(a, i * 170));
// Fired only when a focus phase ends on its own (see frame()) — awards 100, plus a 500 boost on every 4th.
function completeFocusSession() {
  game.coins += SESSION_COINS; game.totalSessions = (game.totalSessions || 0) + 1;   // lifetime count → milestone unlocks
  const rewards = [SESSION_COINS];
  if (++game.sessions >= BONUS_EVERY) { game.sessions = 0; game.coins += BONUS_COINS; rewards.push(BONUS_COINS); }
  saveGame(); updateCoins(true); floatRewards(rewards);
}

// ---- Shop / Customize: spend coins on cosmetic skins (pixel art) + colours ----
let pixelParticles = false, pixelCircle = false;   // renderer flags, derived from equipped skins
let circleStyle = 'default', particleStyle = 'default', rippleStyle = 'default', overlayStyle = 'default';   // shape/scene variants per slot
const SKIN_COST = 1500, COLOR_COST = 500;
// 5-colour palette shared by every colour slot (opt-in accents; monochrome stays the default)
const PALETTE = [
  { id: 'cyan',    name: 'Cyan',    rgb: [61, 220, 255] },
  { id: 'magenta', name: 'Magenta', rgb: [255, 79, 216] },
  { id: 'lime',    name: 'Lime',    rgb: [70, 230, 107] },
  { id: 'amber',   name: 'Amber',   rgb: [255, 176, 32] },
  { id: 'violet',  name: 'Violet',  rgb: [155, 108, 255] },
  { id: 'rose',    name: 'Rose',    rgb: [255, 99, 132] },
  { id: 'sky',     name: 'Sky',     rgb: [90, 170, 255] },
  { id: 'mint',    name: 'Mint',    rgb: [80, 235, 200] },
  { id: 'gold',    name: 'Gold',    rgb: [245, 210, 90] },
];
// items live in slots; each slot holds one equipped item (or 'default'). shape + colour are independent slots.
const SHOP = [
  { id: 'pixelParticle', slot: 'particleShape', kind: 'skin', name: 'Pixel Particles', cost: SKIN_COST, desc: '8-bit blocky sparks instead of soft dots.' },
  { id: 'starParticle',  slot: 'particleShape', kind: 'skin', name: 'Stars',          cost: SKIN_COST, desc: 'Twinkling five-point stars flung from the ring.' },
  { id: 'noteParticle',  slot: 'particleShape', kind: 'skin', name: 'Music Notes',    cost: SKIN_COST, desc: 'Little eighth-notes instead of dots.' },
  { id: 'nyanParticle',  slot: 'particleShape', kind: 'skin', name: 'Nyan Cat',       cost: SKIN_COST, desc: 'Every spark is a tiny Nyan Cat trailing a rainbow.' },
  { id: 'duckParticle',  slot: 'particleShape', kind: 'skin', name: 'Rubber Ducky',   cost: SKIN_COST, desc: 'Squeaky yellow ducks bobbing off the ring.' },
  { id: 'pixelDuckParticle', slot: 'particleShape', kind: 'skin', name: 'Pixel Ducky', cost: SKIN_COST, desc: '8-bit rubber ducks.' },
  { id: 'fireflyParticle', slot: 'particleShape', kind: 'skin', name: 'Fireflies',     cost: SKIN_COST, desc: 'Soft glowing sparks that twinkle in and out.' },
  { id: 'cometParticle',   slot: 'particleShape', kind: 'skin', name: 'Comets',        cost: SKIN_COST, desc: 'Bright heads that streak a fading tail.' },
  { id: 'twinkleParticle', slot: 'particleShape', kind: 'skin', name: 'Twinkle Stars', cost: SKIN_COST, desc: 'Stars that shimmer as they drift.' },
  { id: 'pixelCircle',   slot: 'circleShape',   kind: 'skin', name: 'Pixel Ring',      cost: SKIN_COST, desc: 'The reactive ring rebuilt from chunky pixels.' },
  { id: 'drumRing',      slot: 'circleShape',   kind: 'skin', name: 'Drum',            cost: SKIN_COST, desc: 'A taut drum skin with tuning lugs that bounces on the beat.' },
  { id: 'eqRing',        slot: 'circleShape',   kind: 'skin', name: 'Equalizer Bars',  milestone: 25,   desc: 'Bars around the ring that pump with the music.' },
  // --- Ripple shapes removed for now (didn't trigger often enough); ripples follow the ring colour. Kept for possible revival: ---
  // { id: 'sharpRipple',   slot: 'rippleShape',   kind: 'skin', name: 'Sharp Ripples',   cost: SKIN_COST, desc: 'Jagged shockwave rings instead of soft water.' },
  // { id: 'pixelRipple',   slot: 'rippleShape',   kind: 'skin', name: 'Pixel Ripples',   cost: SKIN_COST, desc: 'Chunky stepped concentric rings.' },
  { id: 'pixelFont',     slot: 'font',          kind: 'skin', name: 'Pixel Type',      cost: SKIN_COST, desc: 'Retro pixel-art numerals on the timer.' },
  { id: 'cursiveFont',   slot: 'font',          kind: 'skin', name: 'Cursive',         cost: SKIN_COST, desc: 'Flowing Pacifico script numerals.' },
  { id: 'romanFont',     slot: 'font',          kind: 'skin', name: 'Roman',           cost: SKIN_COST, desc: 'Classical engraved Cinzel capitals.' },
  { id: 'digitalFont',   slot: 'font',          kind: 'skin', name: 'Digital Clock',   cost: SKIN_COST, desc: 'Seven-segment LCD timer face.' },
  { id: 'mountainsOverlay', slot: 'overlay', kind: 'skin', name: 'Mountains', cost: SKIN_COST, desc: 'Hazy mountain ranges along the horizon — great with Comets.' },
  { id: 'forestOverlay',    slot: 'overlay', kind: 'skin', name: 'Forest',    cost: SKIN_COST, desc: 'A silhouetted pine treeline — great with Fireflies.' },
  { id: 'candylandOverlay', slot: 'overlay', kind: 'skin', name: 'Candyland', cost: SKIN_COST, desc: 'Lollipops & gumdrops — great with Nyan Cat.' },
];
for (const slot of ['particleColor', 'circleColor', /* 'rippleColor' removed */ 'strobeColor'])
  for (const col of PALETTE) SHOP.push({ id: slot + '_' + col.id, slot, kind: 'color', name: col.name, cost: COLOR_COST, rgb: col.rgb });
for (const slot of ['particleColor', 'circleColor', /* 'rippleColor' removed */ 'strobeColor'])   // animated rainbow — unlocked by playing
  SHOP.push({ id: slot + '_rainbow', slot, kind: 'rainbow', name: 'Rainbow', milestone: 15, rgb: [255, 255, 255] });
// Theme packs: one buy/equip applies a coordinated look across many slots + the background gradient
const PACKS = [
  { id: 'synthwavePack', kind: 'pack', name: 'Synthwave', cost: 3000, desc: 'Neon magenta & cyan over a purple dusk.', set: { circleShape: 'default', circleColor: 'circleColor_magenta', particleColor: 'particleColor_cyan', strobeColor: 'strobeColor_magenta', font: 'digitalFont' }, bg: ['#2a1140', '#0a0610'] },
  { id: 'forestPack',    kind: 'pack', name: 'Forest',    cost: 3000, desc: 'Calm greens over a deep woodland night.', set: { circleColor: 'circleColor_lime', particleColor: 'particleColor_mint', strobeColor: 'strobeColor_lime' }, bg: ['#123420', '#050f09'] },
  { id: 'monoPack',      kind: 'pack', name: 'Mono Pixel', cost: 2500, desc: 'All-pixel, no colour — clean & retro.', set: { particleShape: 'pixelParticle', circleShape: 'pixelCircle', font: 'pixelFont', particleColor: 'default', circleColor: 'default', strobeColor: 'default' }, bg: ['#1b212e', '#090c13'] },
  { id: 'firefliesPack', kind: 'pack', name: 'Firefly Night', cost: 3000, desc: 'Twinkling fireflies over a forest night.', set: { particleShape: 'fireflyParticle', particleColor: 'particleColor_gold', circleColor: 'circleColor_mint', strobeColor: 'strobeColor_lime', overlay: 'forestOverlay' }, bg: ['#10241c', '#04080a'] },
  { id: 'cometsPack',    kind: 'pack', name: 'Comet Storm', cost: 3000, desc: 'Icy comets streaking over the mountains.', set: { particleShape: 'cometParticle', particleColor: 'particleColor_sky', circleColor: 'circleColor_cyan', strobeColor: 'strobeColor_cyan', overlay: 'mountainsOverlay' }, bg: ['#0a1430', '#02030a'] },
  { id: 'starsPack',     kind: 'pack', name: 'Starfield',   cost: 3000, desc: 'A sky of softly twinkling stars.', set: { particleShape: 'twinkleParticle', particleColor: 'particleColor_gold', circleColor: 'circleColor_violet', strobeColor: 'strobeColor_violet', overlay: 'mountainsOverlay' }, bg: ['#0c1430', '#03040c'] },
  { id: 'candylandPack', kind: 'pack', name: 'Candyland',   cost: 3000, desc: 'Nyan Cat over a candy wonderland.', set: { particleShape: 'nyanParticle', overlay: 'candylandOverlay', circleColor: 'circleColor_rose', strobeColor: 'strobeColor_magenta' }, bg: ['#3a1430', '#140510'] },
  { id: 'prestigePack',  kind: 'pack', name: 'Prestige',  milestone: 50, desc: 'Gold on black — a 50-session flex.', set: { circleShape: 'drumRing', circleColor: 'circleColor_gold', particleColor: 'particleColor_gold', strobeColor: 'strobeColor_gold', font: 'digitalFont' }, bg: ['#2a2208', '#0c0a03'] },
];
for (const p of PACKS) SHOP.push(p);
// shop layout: each section may carry a skin slot and/or a colour slot
const SECTIONS = [
  { label: 'Theme Packs',     packs: true },
  { label: 'Particles',       skinSlot: 'particleShape', colorSlot: 'particleColor' },
  { label: 'Visualizer ring', skinSlot: 'circleShape',   colorSlot: 'circleColor' },
  // { label: 'Ripples',      skinSlot: 'rippleShape',   colorSlot: 'rippleColor' },   // removed — ripples follow the ring colour now
  { label: 'Font',            skinSlot: 'font' },
  { label: 'Strobe lights',   colorSlot: 'strobeColor' },
  { label: 'Scenery',         skinSlot: 'overlay' },
];
const itemById = id => SHOP.find(s => s.id === id);
// milestone / ownership helpers (used by loadGame's equip guard — defined before `let game` runs below)
function milestoneMet(id, total) { const it = SHOP.find(s => s.id === id); return !!(it && it.milestone != null && (total | 0) >= it.milestone); }
function isUnlocked(it) { return !!game.owned[it.id] || (it.milestone != null && (game.totalSessions | 0) >= it.milestone); }
function isOwned(id, g) { g = g || game; return !!g.owned[id] || milestoneMet(id, g.totalSessions); }
// colour resolution: 'default' → null (caller uses mode colour); rainbow → time-based; else the item's static rgb
function hslToRgb(h, s, l) { h = ((h % 360) + 360) % 360 / 360; const f = n => { const k = (n + h * 12) % 12; return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]; }
function slotRGB(slot) { const id = game.equipped[slot]; if (id && id !== 'default') { const it = itemById(id); if (it && it.rgb) return it.rgb; } return null; }
function resolveColor(slot, now) { const id = game.equipped[slot]; if (!id || id === 'default') return null; const it = itemById(id); if (!it) return null; if (it.kind === 'rainbow') return hslToRgb((now || perf()) * 0.05, 0.85, 0.62); return it.rgb || null; }
let game = loadGame();   // assigned here (after SHOP + helpers) so the equip guard can read SHOP / milestones

// Apply equipped cosmetics: set renderer flags + body font class, then re-fit the timer text.
function applyCosmetics() {
  pixelParticles = game.equipped.particleShape === 'pixelParticle';
  pixelCircle    = game.equipped.circleShape   === 'pixelCircle';
  circleStyle    = game.equipped.circleShape;        // 'default' | 'pixelCircle' | 'drumRing' | 'eqRing'
  particleStyle  = game.equipped.particleShape;      // 'default' | 'pixelParticle' | 'starParticle' | 'noteParticle' | 'nyanParticle'
  rippleStyle    = game.equipped.rippleShape;        // 'default' | 'sharpRipple' | 'pixelRipple'
  overlayStyle   = game.equipped.overlay;            // 'default' | 'mountainsOverlay' | 'forestOverlay' | 'candylandOverlay'
  applyBodyState();                                   // toggles the body.font-* class
  lastFitLen = -1; fitTime(els.time.textContent);     // font metrics changed → re-measure
  const FF = { pixelFont: "'Press Start 2P'", cursiveFont: 'Pacifico', romanFont: 'Cinzel', digitalFont: 'DSEG7' }[game.equipped.font];
  if (FF && document.fonts && document.fonts.load)                    // web-font swap changes metrics async → re-fit when it lands
    document.fonts.load('1em ' + FF).then(() => { lastFitLen = -1; fitTime(els.time.textContent); }).catch(() => {});
  const pk = game.equipped.background !== 'default' ? itemById(game.equipped.background) : null;   // theme-pack background gradient
  if (pk && pk.bg) { document.body.style.setProperty('--bg1', pk.bg[0]); document.body.style.setProperty('--bg2', pk.bg[1]); }
  else { document.body.style.removeProperty('--bg1'); document.body.style.removeProperty('--bg2'); }
}

// little monochrome preview drawn inside each skin card
function previewHTML(it) {
  const svg = inner => `<svg viewBox="0 0 28 28" width="40" height="40">${inner}</svg>`;
  // ring shapes
  if (it.id === 'eqRing') { let b = ''; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, h = 2.5 + (i % 3) * 2.4, r0 = 7; b += `<line x1="${(14+Math.cos(a)*r0).toFixed(1)}" y1="${(14+Math.sin(a)*r0).toFixed(1)}" x2="${(14+Math.cos(a)*(r0+h)).toFixed(1)}" y2="${(14+Math.sin(a)*(r0+h)).toFixed(1)}" stroke="currentColor" stroke-width="1.5"/>`; } return svg(b); }
  if (it.id === 'drumRing') { let l = ''; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; l += `<rect x="${(14+Math.cos(a)*10.5-1).toFixed(1)}" y="${(14+Math.sin(a)*10.5-1).toFixed(1)}" width="2" height="2" fill="currentColor"/>`; } return svg(`<circle cx="14" cy="14" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="14" cy="14" r="5" fill="none" stroke="currentColor" stroke-width="1" opacity=".5"/>${l}`); }
  // particle shapes
  if (it.id === 'starParticle') { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI/2 + i*Math.PI/5, rr = i % 2 ? 4 : 9.5; p.push(`${(14+Math.cos(a)*rr).toFixed(1)},${(14+Math.sin(a)*rr).toFixed(1)}`); } return svg(`<polygon points="${p.join(' ')}" fill="currentColor"/>`); }
  if (it.id === 'noteParticle') return svg(`<ellipse cx="10" cy="19" rx="4" ry="3" fill="currentColor"/><rect x="13" y="7" width="2" height="11" fill="currentColor"/><path d="M13 7 q6 1 5 6 q0 -4 -5 -3 z" fill="currentColor"/>`);
  if (it.id === 'nyanParticle') return `<div class="nyan-thumb"></div>`;   // the real sprite, cropped to the nyan band
  if (it.id === 'duckParticle') return svg(`<ellipse cx="12" cy="18" rx="9" ry="6" fill="#ffd23d"/><circle cx="18" cy="11" r="5" fill="#ffd23d"/><polygon points="22,10 27,11.5 22,13" fill="#ff921a"/><circle cx="19" cy="10" r="1.2" fill="#1c1c1c"/>`);
  if (it.id === 'pixelDuckParticle') { const u = 2.6, ox = 2.3, oy = 3.6; let b = ''; for (let r = 0; r < DUCK_PX.length; r++) for (let c = 0; c < 9; c++) { const ch = DUCK_PX[r][c]; if (ch === '.') continue; const col = ch === 'O' ? '#ff921a' : ch === 'E' ? '#1c1c1c' : '#ffd23d'; b += `<rect x="${(ox+c*u).toFixed(1)}" y="${(oy+r*u).toFixed(1)}" width="${u}" height="${u}" fill="${col}"/>`; } return svg(b); }
  if (it.id === 'fireflyParticle') return svg(`<circle cx="14" cy="14" r="9.5" fill="currentColor" opacity=".16"/><circle cx="14" cy="14" r="5.5" fill="currentColor" opacity=".5"/><circle cx="14" cy="14" r="2.6" fill="currentColor"/>`);
  if (it.id === 'cometParticle') return svg(`<polygon points="18,11 18,17 3,14" fill="currentColor" opacity=".45"/><circle cx="19" cy="14" r="4" fill="currentColor"/>`);
  if (it.id === 'twinkleParticle') { const p = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 4 : 9.5; p.push(`${(14+Math.cos(a)*rr).toFixed(1)},${(14+Math.sin(a)*rr).toFixed(1)}`); } return svg(`<polygon points="${p.join(' ')}" fill="currentColor"/>`); }
  // scenery overlays (own thematic colours)
  if (it.id === 'mountainsOverlay') return svg(`<polygon points="0,27 8,11 13,18 20,7 28,27" fill="#5a6ea0"/><polygon points="0,28 6,18 12,23 18,15 24,22 28,18 28,28" fill="#2c3a62"/>`);
  if (it.id === 'forestOverlay') return svg(`<g fill="#1f5436"><polygon points="5,26 1,26 3,15"/><polygon points="14,27 7,27 10.5,12"/><polygon points="22,26 16,26 19,15"/><polygon points="28,27 22,27 25,16"/></g>`);
  if (it.id === 'candylandOverlay') return svg(`<rect x="7.2" y="14" width="1.6" height="13" fill="#fff"/><circle cx="8" cy="11" r="5" fill="#ff9ecb"/><path d="M16 27 a5.5 5.5 0 0 1 11 0 z" fill="#a8e6ff"/>`);
  // ripple shapes (removed from shop; previews kept harmlessly for revival)
  if (it.id === 'sharpRipple') return svg(`<polygon points="14,3 17,11 25,14 17,17 14,25 11,17 3,14 11,11" fill="none" stroke="currentColor" stroke-width="1.6"/>`);
  if (it.id === 'pixelRipple') { let b = ''; for (const rr of [5, 9.5]) { const n = 8; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; b += `<rect x="${(14+Math.cos(a)*rr-1.5).toFixed(1)}" y="${(14+Math.sin(a)*rr-1.5).toFixed(1)}" width="3" height="3" fill="currentColor"/>`; } } return svg(b); }
  // generic fallbacks
  if (it.slot === 'font') { const fam = { pixelFont: "'Press Start 2P',monospace", cursiveFont: "'Pacifico',cursive", romanFont: "'Cinzel',serif", digitalFont: "'DSEG7',monospace" }[it.id] || 'monospace'; return `<span class="pixfont-sample" style="font-family:${fam}">12<br>34</span>`; }
  if (it.slot === 'particleShape') { const sq = [[5,6,4],[16,8,4],[9,15,5],[19,17,4],[13,11,3]]; return svg(sq.map(([x,y,s]) => `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="currentColor"/>`).join('')); }
  let r = ''; const n = 12, R = 9, g = 3.2;             // circle: a ring of pixel blocks (pixelCircle)
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; r += `<rect x="${(14 + Math.cos(a)*R - g/2).toFixed(1)}" y="${(14 + Math.sin(a)*R - g/2).toFixed(1)}" width="${g}" height="${g}" fill="currentColor"/>`; }
  return svg(r);
}
function skinCardHTML(it) {
  const unlocked = isUnlocked(it), eq = game.equipped[it.slot] === it.id;
  let btn;
  if (unlocked) btn = `<button class="shop-buy${eq ? ' equipped' : ''}" data-act="${eq ? 'default' : 'equip'}" data-id="${it.id}" data-slot="${it.slot}">${eq ? 'Equipped' : 'Equip'}</button>`;
  else if (it.milestone != null) btn = `<button class="shop-buy broke" disabled>${(game.totalSessions | 0)}/${it.milestone} sessions</button>`;
  else { const afford = game.coins >= it.cost; btn = `<button class="shop-buy${afford ? '' : ' broke'}" data-act="buy" data-id="${it.id}">${ICON.coin}${it.cost.toLocaleString()}</button>`; }
  return `<div class="shop-item${eq ? ' is-equipped' : ''}"><div class="shop-preview">${previewHTML(it)}</div>`
       + `<div class="shop-info"><div class="shop-name">${it.name}</div><div class="shop-desc">${it.desc}</div></div>${btn}</div>`;
}
const RAINBOW_SW = 'conic-gradient(from 0deg,#ff5d5d,#ffb020,#f5e64a,#46e66b,#3ddcff,#5a8cff,#b86cff,#ff5d5d)';
function colorRowHTML(slot) {
  const eqId = game.equipped[slot];
  let sw = `<button class="swatch swatch-default${eqId === 'default' ? ' equipped' : ''}" title="Default (auto)" data-act="default" data-slot="${slot}"></button>`;
  for (const it of SHOP.filter(s => s.slot === slot && (s.kind === 'color' || s.kind === 'rainbow'))) {
    const eq = eqId === it.id, unlocked = isUnlocked(it);
    const swv = it.kind === 'rainbow' ? RAINBOW_SW : `rgb(${it.rgb[0]},${it.rgb[1]},${it.rgb[2]})`;
    let cls, act, title;
    if (it.milestone != null) {                          // milestone-gated (free once reached, e.g. Rainbow)
      cls = 'swatch' + (unlocked ? '' : ' locked') + (eq ? ' equipped' : '');
      act = unlocked ? (eq ? 'default' : 'equip') : '';
      title = it.name + (unlocked ? '' : ' · ' + (game.totalSessions | 0) + '/' + it.milestone + ' sessions');
    } else {                                             // coin-bought palette colour
      const afford = game.coins >= it.cost;
      cls = 'swatch' + (unlocked ? '' : (afford ? ' locked' : ' locked broke')) + (eq ? ' equipped' : '');
      act = unlocked ? (eq ? 'default' : 'equip') : 'buy';
      title = it.name + (unlocked ? '' : ' · ' + it.cost);
    }
    sw += `<button class="${cls}" style="--sw:${swv}" title="${title}"${act ? ` data-act="${act}"` : ''} data-id="${it.id}" data-slot="${slot}"></button>`;
  }
  return `<div class="shop-colors"><span class="shop-colabel">Color · ${ICON.coin}${COLOR_COST} each</span><div class="swatch-row">${sw}</div></div>`;
}
function packPreviewHTML(it) {
  let chips = it.bg ? `<span style="background:linear-gradient(${it.bg[0]},${it.bg[1]})"></span>` : '';
  for (const s of ['circleColor', 'particleColor', 'strobeColor']) {
    const id = it.set[s]; if (!id || id === 'default') continue;
    const ci = itemById(id); if (ci && ci.rgb) chips += `<span style="background:rgb(${ci.rgb[0]},${ci.rgb[1]},${ci.rgb[2]})"></span>`;
  }
  return `<div class="pack-swatches">${chips}</div>`;
}
function packCardHTML(it) {
  const unlocked = isUnlocked(it), eq = game.equipped.theme === it.id;
  let btn;
  if (eq) btn = `<button class="shop-buy equipped" data-act="unpack">Equipped</button>`;
  else if (unlocked) btn = `<button class="shop-buy" data-act="equip" data-id="${it.id}">Equip</button>`;
  else if (it.milestone != null) btn = `<button class="shop-buy broke" disabled>${(game.totalSessions | 0)}/${it.milestone} sessions</button>`;
  else { const afford = game.coins >= it.cost; btn = `<button class="shop-buy${afford ? '' : ' broke'}" data-act="buy" data-id="${it.id}">${ICON.coin}${it.cost.toLocaleString()}</button>`; }
  return `<div class="shop-item${eq ? ' is-equipped' : ''}"><div class="shop-preview">${packPreviewHTML(it)}</div>`
       + `<div class="shop-info"><div class="shop-name">${it.name}</div><div class="shop-desc">${it.desc}</div></div>${btn}</div>`;
}
function renderShop() {
  els.shopBalance.innerHTML = ICON.coin + '<span>' + game.coins.toLocaleString() + '</span>';
  let html = '';
  for (const sec of SECTIONS) {
    html += `<div class="group"><span class="glabel">${sec.label}</span>`;
    if (sec.packs) for (const it of SHOP.filter(s => s.kind === 'pack')) html += packCardHTML(it);
    if (sec.skinSlot) for (const it of SHOP.filter(s => s.slot === sec.skinSlot && s.kind === 'skin')) html += skinCardHTML(it);
    if (sec.colorSlot) html += colorRowHTML(sec.colorSlot);
    html += `</div>`;
  }
  els.shopBody.innerHTML = html;
}
function applyPack(it) {                                      // equip a whole coordinated look at once
  for (const s in it.set) if (s in game.equipped) game.equipped[s] = it.set[s];
  game.equipped.theme = it.id; game.equipped.background = it.bg ? it.id : 'default';
}
function grantPack(it) { for (const s in it.set) if (it.set[s] !== 'default') game.owned[it.set[s]] = true; }   // its components become owned too
function clearThemeIfBroken() {                              // a manual slot change that diverges from the pack un-sets it
  const p = itemById(game.equipped.theme); if (!p || p.kind !== 'pack') return;
  for (const s in p.set) if (game.equipped[s] !== p.set[s]) { game.equipped.theme = 'default'; game.equipped.background = 'default'; return; }
}
function clearPack() {                                        // "unequip" the active pack: revert its slots + the background
  const p = itemById(game.equipped.theme); if (p && p.set) for (const s in p.set) if (s in game.equipped) game.equipped[s] = 'default';
  game.equipped.theme = 'default'; game.equipped.background = 'default'; commitCosmetic(false);
}
function commitCosmetic(spent) {
  clearThemeIfBroken();
  saveGame(); applyCosmetics(); updateCoins(true); renderShop();
  if (spent && els.shopBalance.animate) els.shopBalance.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 300, easing: 'ease-out' });
}
// rising "−N" popup by the shop balance on a purchase (renderShop rebuilds the balance, so add this AFTER it)
function floatSpend(amount) {
  const el = document.createElement('div');
  el.className = 'spend-pop'; el.textContent = '−' + amount.toLocaleString();
  el.addEventListener('animationend', () => el.remove());
  els.shopBalance.appendChild(el);
}
function buyItem(id) {
  const it = itemById(id); if (!it || it.cost == null || game.owned[id] || game.coins < it.cost) return;
  game.coins -= it.cost; game.owned[id] = true;
  if (it.kind === 'pack') { grantPack(it); applyPack(it); } else game.equipped[it.slot] = id;   // buying auto-equips
  commitCosmetic(true); floatSpend(it.cost);
}
function equipItem(id) {
  const it = itemById(id); if (!it || !isUnlocked(it)) return;
  if (it.kind === 'pack') { grantPack(it); applyPack(it); } else game.equipped[it.slot] = id;
  commitCosmetic(false);
}
function setDefault(slot) { if (!(slot in game.equipped)) return; game.equipped[slot] = 'default'; commitCosmetic(false); }
// ---- Admin / test mode (bottom-right of the shop; unlock by typing 1111) ----
let adminOn = false;
function renderAdmin() {
  els.adminToggle.style.display = adminOn ? 'none' : '';
  els.adminInput.style.display = 'none';
  els.adminTools.style.display = adminOn ? 'flex' : 'none';
  els.adminTools.innerHTML = adminOn
    ? `<button data-admin="1000">+1,000</button><button data-admin="10000">+10,000</button><button data-admin="sess">+5 sess</button><button data-admin="unlock">Unlock all</button><button data-admin="reset">Reset</button>`
    : '';
}
function adminAction(v) {
  if (v === 'unlock') { for (const it of SHOP) game.owned[it.id] = true; }
  else if (v === 'reset') { game.coins = 0; game.sessions = 0; game.totalSessions = 0; game.owned = {}; for (const k in game.equipped) game.equipped[k] = 'default'; }
  else if (v === 'sess') game.totalSessions = (game.totalSessions | 0) + 5;
  else game.coins += parseInt(v, 10) || 0;
  saveGame(); applyCosmetics(); updateCoins(true); renderShop(); renderAdmin();
}
function openShop()  { renderShop(); renderAdmin(); els.shopOverlay.classList.add('open'); }
function closeShop() { els.shopOverlay.classList.remove('open'); }
