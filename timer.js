"use strict";
// ================= Pomodoro state machine =================
let PH = 'idle', mode = 'work', shortCount = 0, remainingMs = 0, endTs = 0;
let retracting = false, lastCountNum = null, introStart = 0;
let INTRO_MS = 3000; const REDRAW_MS = 700;

const dur = m => (m === 'work' ? settings.workMin : m === 'short' ? settings.shortMin : settings.longMin) * 60 * 1000;
const modeName = m => m === 'work' ? 'Focus' : m === 'short' ? 'Short Break' : 'Long Break';
function fmt(ms) { const s = Math.max(0, Math.round(ms / 1000)); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }
function setBigCount(n) { const t = String(n); els.time.textContent = t; fitTime(t); }
function setNormalTime(ms) { const t = fmt(ms); els.time.textContent = t; fitTime(t); }

function renderDots() {
  let html = '';
  for (let i = 0; i < settings.cycles; i++) html += `<span class="dot${i < shortCount ? ' done' : ''}"></span>`;
  html += `<span class="dot long${mode === 'long' ? ' done' : ''}"></span>`;
  els.dots.innerHTML = html;
}
function applyBodyState() {
  els.body.className = [
    settings.theme === 'light' ? 'theme-light' : 'theme-dark',
    settings.showVideo ? '' : 'no-video',
    PH === 'idle' ? 'idle' : 'active',
    ({ pixelFont: 'font-pixel', cursiveFont: 'font-cursive', romanFont: 'font-roman', digitalFont: 'font-digital' })[game.equipped.font] || ''   // font shop item
  ].filter(Boolean).join(' ');
}
function updateModeLabel(text) { els.modeLabel.textContent = text || (PH === 'idle' ? 'Ready' : PH === 'intro' ? 'Get Ready' : modeName(mode)); applyBodyState(); }
function updateButtons() { els.mainBtn.textContent = PH === 'idle' ? 'Start' : PH === 'intro' ? 'Cancel' : PH === 'run' ? 'Pause' : 'Resume'; }
function updateThemeBtn() { els.themeBtn.innerHTML = settings.theme === 'light' ? ICON.sun : ICON.moon; }

function nextMode() {
  if (mode === 'work') {
    if (shortCount >= settings.cycles) mode = 'long';       // had all the short breaks → long break now
    else { mode = 'short'; shortCount++; }
  } else {
    if (mode === 'long') shortCount = 0;                    // long break done → start a fresh set
    mode = 'work';
  }
}
function beginFresh() {
  if (!settings.workUrl && !settings.breakUrl) { openSettings(); return; }
  ensureAudio();
  playTransitionMelody(true);                                     // into-focus cue during the start countdown
  if (settings.reactToAudio && !realAudioOn) enableRealAudio();   // prompts for tab-audio share
  clearSession(); workLoaded = breakLoaded = null; sessionRestore = null;
  mode = 'work'; shortCount = 0;
  PH = 'intro'; introStart = perf(); lastCountNum = null;
  playActive({ muted: true, startSeconds: 0 });
  drawIn(INTRO_MS);
  updateModeLabel('Get Ready'); updateButtons(); renderDots();
}
function enterRun(now) {
  PH = 'run'; retracting = false; lastCountNum = null;
  playActive({ fromZero: true }); spawnRipple(1.0); setFull();   // first work session starts from the top
  remainingMs = dur(mode); endTs = now + remainingMs;
  updateModeLabel(); updateButtons(); saveSession();
}
function doSwitch(now) {
  nextMode(); playActive({});                                    // resume the new mode's track where it left off
  spawnRipple(0.6); drawIn(REDRAW_MS);
  retracting = false; lastCountNum = null;
  remainingMs = dur(mode); endTs = now + remainingMs;
  updateModeLabel(); renderDots(); saveSession();
}
function pauseTimer()  { if (PH === 'run') { remainingMs = Math.max(0, endTs - perf()); PH = 'paused'; pauseAudio(); updateButtons(); saveSession(); } }
function resumeTimer() {
  if (PH === 'paused') {
    ensureAudio();
    if (settings.reactToAudio && !realAudioOn) enableRealAudio();   // re-prompt for tab share after a refresh
    PH = 'run'; endTs = perf() + remainingMs; sessionRestore = null; playActive({}); updateButtons(); saveSession();
  }
}
function reset() {
  PH = 'idle'; mode = 'work'; shortCount = 0; retracting = false; lastCountNum = null;
  remainingMs = dur('work'); pauseAudio(); hideCircle(); ripples.length = 0; particles.length = 0;
  workLoaded = breakLoaded = null; sessionRestore = null; clearSession(); resetRave();
  els.frameWork.classList.remove('active'); els.frameBreak.classList.remove('active');
  setNormalTime(remainingMs); updateModeLabel(); updateButtons(); renderDots();
}
function skip() { if (PH === 'run' || PH === 'paused') { PH = 'run'; doSwitch(perf()); updateButtons(); } }
function onMain() {
  if (PH === 'idle') beginFresh();
  else if (PH === 'intro') reset();
  else if (PH === 'run') pauseTimer();
  else if (PH === 'paused') resumeTimer();
}
