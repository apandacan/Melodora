"use strict";
// ================= Main loop =================
let lastNow = null;
function frame(now) {
  if (lastNow == null) lastNow = now;
  let dt = now - lastNow; lastNow = now; if (dt > 250) dt = 16;
  layoutCenter();
  if (PH === 'intro') {
    const introRemain = Math.max(0, INTRO_MS - (now - introStart)), num = Math.ceil(introRemain / 1000);
    if (num > 0) setBigCount(num);
    if (now - introStart >= INTRO_MS) enterRun(now);
  } else if (PH === 'run') {
    remainingMs = Math.max(0, endTs - now);
    if (remainingMs <= 3000) {
      // play the transition cue once, keyed to the mode we're about to enter
      if (!retracting) { retracting = true; lastCountNum = null; drawOut(3000); playTransitionMelody(mode !== 'work'); }
      const num = Math.ceil(remainingMs / 1000);
      if (num > 0) setBigCount(num);
    } else { if (retracting) retracting = false; setNormalTime(remainingMs); }
    if (remainingMs <= 0) { if (mode === 'work') completeFocusSession(); doSwitch(now); }   // award only on natural focus completion
    if (now - lastSave > 1500) { lastSave = now; saveSession(); }   // keep the saved time/position fresh
  } else if (PH === 'paused') { setNormalTime(remainingMs); }

  updateCircle(now);
  const sig = audioSignal(now);
  // beat envelope: jump instantly to the louder of (energy, transient), then ease down → beats visibly punch
  const drive = Math.max(sig.level, sig.intensity);
  vizLevelEnv = Math.max(drive, vizLevelEnv * Math.pow(0.90, dt / 16));
  updateRave(now, dt, sig);
  // ease the reactive amplitude toward its target so the waveform melts back to a circle on pause
  const reactiveTarget = (settings.showViz && PH === 'run' && !retracting && circle.amount >= 1) ? 1 : 0;
  vizAmp += (reactiveTarget - vizAmp) * Math.min(1, dt / 280);
  if (reactiveTarget && vizAmp > 0.15) maybeSpawnParticles(sig, dt, now);
  updateParticles(dt); updateRipples(dt); render(now, sig);
  if (now - lastScrub > 150) { lastScrub = now; updateScrubber(); }
  requestAnimationFrame(frame);
}

// ================= Volume bar =================
function volIconSVG(level) {
  const head = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">';
  const spk = '<path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none"/>';
  let waves = level <= 0 ? '<path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>'
    : level < 45 ? '<path d="M16.5 9.5a4 4 0 0 1 0 5"/>'
    : '<path d="M16.5 9.5a4 4 0 0 1 0 5"/><path d="M19 7a8 8 0 0 1 0 10"/>';
  return head + spk + waves + '</svg>';
}
function updateVolIcon() { els.volIcon.innerHTML = volIconSVG(settings.masterVol); }

// monochrome icons (currentColor → matches theme palette, no emoji)
const SW = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
const ICON = {
  coin: `<svg width="17" height="17" viewBox="0 0 24 24" ${SW}><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/></svg>`,
  shop: `<svg width="20" height="20" viewBox="0 0 24 24" ${SW}><path d="M6 8h12l-1 10.5a2 2 0 0 1-2 1.5H9a2 2 0 0 1-2-1.5L6 8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>`,
  gear: `<svg width="20" height="20" viewBox="0 0 24 24" ${SW}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  moon: `<svg width="20" height="20" viewBox="0 0 24 24" ${SW}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
  sun:  `<svg width="20" height="20" viewBox="0 0 24 24" ${SW}><circle cx="12" cy="12" r="4.2"/><line x1="12" y1="1.6" x2="12" y2="3.6"/><line x1="12" y1="20.4" x2="12" y2="22.4"/><line x1="3.7" y1="3.7" x2="5.2" y2="5.2"/><line x1="18.8" y1="18.8" x2="20.3" y2="20.3"/><line x1="1.6" y1="12" x2="3.6" y2="12"/><line x1="20.4" y1="12" x2="22.4" y2="12"/><line x1="3.7" y1="20.3" x2="5.2" y2="18.8"/><line x1="18.8" y1="5.2" x2="20.3" y2="3.7"/></svg>`
};
function paintRange(el) { const min = +el.min || 0, max = +el.max || 100, p = ((+el.value - min) / (max - min)) * 100; el.style.background = `linear-gradient(to right, var(--fg) ${p}%, var(--track) ${p}%)`; }
function paintAllRanges() { [els.masterVol, els.workVol, els.breakVol, els.cueVol, els.cuePitch, els.cueTone, els.vizIntensity, els.quietGate, els.raveCd].forEach(paintRange); }
// quick preview chord so pitch/tone/volume tweaks are audible immediately
function previewCue() {
  ensureAudio();
  const tr = Math.pow(2, (settings.cuePitch || 0) / 12);
  const vol = 0.22 * ((settings.cueVol == null ? 80 : settings.cueVol) / 100) * 0.7;
  [587.33, 392.00, 523.25].forEach(n => chime(n * tr, 0, vol, 1.3));
}

// ================= Settings UI =================
function applyDisplayPrefs() { els.body.classList.toggle('no-video', !settings.showVideo); if (PH !== 'idle') showActiveFrame(); }
function openSettings()  { fillForm(); els.overlay.classList.add('open'); }
// Persist whatever is currently in the form — called on every close (incl. clicking off / Esc) so nothing is lost.
function commitSettings() {
  const oldW = settings.workUrl, oldB = settings.breakUrl;
  readForm(); saveSettings(settings); parseSrc(); applyBodyState(); applyDisplayPrefs();
  applyVol(workPlayer, settings.workVol); applyVol(breakPlayer, settings.breakVol);
  if (oldW !== settings.workUrl) workLoaded = null;          // a changed URL must reload that track
  if (oldB !== settings.breakUrl) breakLoaded = null;
  if (PH === 'run' && loadedFor(audioMode()) === null) playActive({ startSeconds: 0 });
  if (PH === 'idle') { remainingMs = dur(mode); setNormalTime(remainingMs); }
  updateModeLabel(); updateButtons(); renderDots();
}
let autoPromptedRA = false;
function closeSettings() {
  if (els.overlay.classList.contains('open')) commitSettings();
  els.overlay.classList.remove('open');
  // closing the panel is a user gesture → a good moment to request the tab-audio share
  if (settings.reactToAudio && !realAudioOn && !autoPromptedRA) { autoPromptedRA = true; enableRealAudio(); }
}
function applySettings() { closeSettings(); }

els.mainBtn.addEventListener('click', onMain);
els.resetBtn.addEventListener('click', reset);
els.skipBtn.addEventListener('click', skip);
els.scrubber.addEventListener('pointerdown', e => { scrubDragging = true; try { els.scrubber.setPointerCapture(e.pointerId); } catch {} const f = scrubFrac(e); els.scrubFill.style.width = (f*100)+'%'; seekToFrac(f); });
els.scrubber.addEventListener('pointermove', e => { if (!scrubDragging) return; const f = scrubFrac(e); els.scrubFill.style.width = (f*100)+'%'; });
els.scrubber.addEventListener('pointerup', e => { if (!scrubDragging) return; scrubDragging = false; seekToFrac(scrubFrac(e)); try { els.scrubber.releasePointerCapture(e.pointerId); } catch {} });
els.scrubber.addEventListener('pointercancel', () => { scrubDragging = false; });
els.gear.addEventListener('click', openSettings);
els.closeBtn.addEventListener('click', closeSettings);
els.overlay.addEventListener('click', e => { if (e.target === els.overlay) closeSettings(); });
els.shopBtn.addEventListener('click', openShop);
els.shopClose.addEventListener('click', closeShop);
els.shopOverlay.addEventListener('click', e => { if (e.target === els.shopOverlay) closeShop(); });
els.shopBody.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  if (act === 'buy') buyItem(b.dataset.id);
  else if (act === 'equip') equipItem(b.dataset.id);
  else if (act === 'default') setDefault(b.dataset.slot);
  else if (act === 'unpack') clearPack();
});
els.adminToggle.addEventListener('click', () => { els.adminInput.style.display = 'inline-block'; els.adminInput.value = ''; els.adminInput.focus(); });
els.adminInput.addEventListener('input', () => { if (els.adminInput.value === '1111') { adminOn = true; renderAdmin(); } });
els.adminTools.addEventListener('click', e => { const b = e.target.closest('[data-admin]'); if (b) adminAction(b.dataset.admin); });
els.themeBtn.addEventListener('click', () => { settings.theme = settings.theme === 'light' ? 'dark' : 'light'; saveSettings(settings); applyBodyState(); updateThemeBtn(); paintAllRanges(); });
// live track balance (apply while dragging, persist on release)
els.workVol.addEventListener('input', () => { els.workVolVal.textContent = els.workVol.value; paintRange(els.workVol); applyVol(workPlayer, clampInt(els.workVol.value,0,100,80)); });
els.breakVol.addEventListener('input', () => { els.breakVolVal.textContent = els.breakVol.value; paintRange(els.breakVol); applyVol(breakPlayer, clampInt(els.breakVol.value,0,100,80)); });
els.cueVol.addEventListener('input', () => { els.cueVolVal.textContent = els.cueVol.value; paintRange(els.cueVol); settings.cueVol = clampInt(els.cueVol.value,0,100,80); });
els.cuePitch.addEventListener('input', () => { settings.cuePitch = clampInt(els.cuePitch.value,-12,12,2); els.cuePitchVal.textContent = (settings.cuePitch>0?'+':'')+settings.cuePitch; paintRange(els.cuePitch); });
els.cueTone.addEventListener('input', () => { settings.cueTone = clampInt(els.cueTone.value,0,100,0); els.cueToneVal.textContent = els.cueTone.value; paintRange(els.cueTone); });
[els.cueVol, els.cuePitch, els.cueTone].forEach(el => el.addEventListener('change', previewCue));
els.vizIntensity.addEventListener('input', () => { els.vizIntensityVal.textContent = els.vizIntensity.value; paintRange(els.vizIntensity); settings.vizIntensity = clampInt(els.vizIntensity.value,0,100,80); });
els.quietGate.addEventListener('input', () => { els.quietGateVal.textContent = els.quietGate.value; paintRange(els.quietGate); settings.quietGate = clampInt(els.quietGate.value,0,100,10); });
els.raveCd.addEventListener('input', () => { els.raveCdVal.textContent = els.raveCd.value; paintRange(els.raveCd); settings.raveCd = clampInt(els.raveCd.value,1,30,3); });
els.raveTest.addEventListener('change', () => {
  raveTest = els.raveTest.checked; ensureAudio();
  if (raveTest) { if (rave.phase === 'off' || rave.phase === 'falling') { rave.phase = 'rising'; rave.onStart = perf(); rave.low = 0; } }
  else if (rave.phase === 'on' || rave.phase === 'rising') rave.phase = 'falling';
});
els.masterVol.addEventListener('input', () => { settings.masterVol = clampInt(els.masterVol.value, 0, 100, 100); updateVolIcon(); paintRange(els.masterVol); applyVol(activePlayer(), activeTrackVol()); });
els.masterVol.addEventListener('change', () => saveSettings(settings));
els.reactToAudio.addEventListener('change', async () => {
  if (els.reactToAudio.checked) { const ok = await enableRealAudio(); if (!ok) els.reactToAudio.checked = false; }
  else { stopRealAudio(); }
  commitSettings();
});
// Auto-save in real time: every settings field commits on change (clicking a toggle takes effect instantly).
[els.workUrl, els.breakUrl, els.workMin, els.shortMin, els.longMin, els.cycles,
 els.workVol, els.breakVol, els.cueVol, els.cuePitch, els.cueTone, els.vizIntensity, els.quietGate, els.showVideo, els.showViz, els.calmParticles, els.rave, els.raveCd, els.raveFull]
  .forEach(el => el.addEventListener('change', commitSettings));
document.addEventListener('keydown', e => {
  if (els.shopOverlay.classList.contains('open')) { if (e.key === 'Escape') closeShop(); return; }
  if (els.overlay.classList.contains('open')) { if (e.key === 'Escape') closeSettings(); return; }
  if (e.code === 'Space') { e.preventDefault(); onMain(); }
  else if (e.key.toLowerCase() === 'r') reset();
  else if (e.key.toLowerCase() === 's') skip();
});
// persist the live session when leaving / hiding the tab so a refresh can resume it
window.addEventListener('beforeunload', saveSession);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveSession(); });

// ================= Init =================
parseSrc();
resize(); layoutCenter();
els.gear.innerHTML = ICON.gear;
els.coinIcon.innerHTML = ICON.coin; updateCoins();
els.shopBtn.innerHTML = ICON.shop + '<span>Customize</span>';
els.masterVol.value = settings.masterVol; updateVolIcon(); paintAllRanges();
mode = 'work'; remainingMs = dur('work');
const restored = restoreSession();   // resume time + music position from a prior refresh, paused & ready
if (!restored) { setNormalTime(remainingMs); }
updateThemeBtn(); applyBodyState(); updateModeLabel(); updateButtons(); renderDots(); applyCosmetics();
requestAnimationFrame(frame);
// Only auto-open settings if there's genuinely nothing to play yet — otherwise land on the timer
// so the first click is Start (which triggers the audio-share prompt), not "close settings".
if (!restored && firstVisit && !settings.workUrl && !settings.breakUrl) openSettings();
