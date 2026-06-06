"use strict";
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const clampInt = (v, min, max, d) => { let n = parseInt(v, 10); if (isNaN(n)) n = d; return Math.min(max, Math.max(min, n)); };
const easeOutCubic   = t => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = t => t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
const perf = () => performance.now();

// ================= Settings =================
const DEFAULTS = {
  workUrl: 'https://www.youtube.com/watch?v=TG5fiu0XctM',
  breakUrl: 'https://www.youtube.com/watch?v=rYoZgpAEkFs',
  workMin: 35, shortMin: 5, longMin: 10, cycles: 3,   // cycles = short breaks before a long break
  workVol: 80, breakVol: 80, masterVol: 100, cueVol: 80, cuePitch: 2, cueTone: 0,
  showVideo: true, showViz: true, reactToAudio: true, vizIntensity: 80, quietGate: 10, calmParticles: false,
  rave: true, raveCd: 3, raveFull: false, theme: 'dark'
};
const loadSettings = () => { try { const r = localStorage.getItem('melodora.settings'); return r ? { ...DEFAULTS, ...JSON.parse(r) } : null; } catch { return null; } };
const saveSettings = s => { try { localStorage.setItem('melodora.settings', JSON.stringify(s)); } catch {} };
let settings = loadSettings() || { ...DEFAULTS };
const firstVisit = !loadSettings();

const $ = id => document.getElementById(id);
const els = {
  body: document.body, modeLabel: $('modeLabel'), time: $('time'), dots: $('dots'),
  mainBtn: $('mainBtn'), resetBtn: $('resetBtn'), skipBtn: $('skipBtn'),
  themeBtn: $('themeBtn'), gear: $('gear'), overlay: $('overlay'), closeBtn: $('closeBtn'),
  coins: $('coins'), coinIcon: $('coinIcon'), coinNum: $('coinNum'), coinPops: $('coinPops'),
  shopBtn: $('shopBtn'), shopOverlay: $('shopOverlay'), shopClose: $('shopClose'), shopBody: $('shopBody'), shopBalance: $('shopBalance'),
  adminToggle: $('adminToggle'), adminInput: $('adminInput'), adminTools: $('adminTools'),
  masterVol: $('masterVol'), volIcon: $('volIcon'), vizIntensity: $('vizIntensity'), vizIntensityVal: $('vizIntensityVal'),
  quietGate: $('quietGate'), quietGateVal: $('quietGateVal'),
  workUrl: $('workUrl'), breakUrl: $('breakUrl'),
  workMin: $('workMin'), shortMin: $('shortMin'), longMin: $('longMin'), cycles: $('cycles'),
  workVol: $('workVol'), breakVol: $('breakVol'), workVolVal: $('workVolVal'), breakVolVal: $('breakVolVal'),
  cueVol: $('cueVol'), cueVolVal: $('cueVolVal'), cuePitch: $('cuePitch'), cuePitchVal: $('cuePitchVal'), cueTone: $('cueTone'), cueToneVal: $('cueToneVal'),
  showVideo: $('showVideo'), showViz: $('showViz'), reactToAudio: $('reactToAudio'), calmParticles: $('calmParticles'),
  rave: $('rave'), raveCd: $('raveCd'), raveCdVal: $('raveCdVal'), raveTest: $('raveTest'), raveFull: $('raveFull'),
  frameWork: $('frameWork'), frameBreak: $('frameBreak'), viz: $('viz'), centerText: $('centerText'),
  scrubber: $('scrubber'), scrubFill: $('scrubFill'),
};

function fillForm() {
  els.workUrl.value = settings.workUrl; els.breakUrl.value = settings.breakUrl;
  els.workMin.value = settings.workMin; els.shortMin.value = settings.shortMin;
  els.longMin.value = settings.longMin; els.cycles.value = settings.cycles;
  els.workVol.value = settings.workVol; els.breakVol.value = settings.breakVol;
  els.workVolVal.textContent = settings.workVol; els.breakVolVal.textContent = settings.breakVol;
  els.cueVol.value = settings.cueVol; els.cueVolVal.textContent = settings.cueVol;
  els.cuePitch.value = settings.cuePitch; els.cuePitchVal.textContent = (settings.cuePitch > 0 ? '+' : '') + settings.cuePitch;
  els.cueTone.value = settings.cueTone; els.cueToneVal.textContent = settings.cueTone;
  els.showVideo.checked = settings.showVideo; els.showViz.checked = settings.showViz;
  els.reactToAudio.checked = settings.reactToAudio; els.calmParticles.checked = settings.calmParticles;
  els.rave.checked = settings.rave; els.raveCd.value = settings.raveCd; els.raveCdVal.textContent = settings.raveCd;
  els.raveFull.checked = settings.raveFull; els.raveTest.checked = raveTest;
  els.vizIntensity.value = settings.vizIntensity; els.vizIntensityVal.textContent = settings.vizIntensity;
  els.quietGate.value = settings.quietGate; els.quietGateVal.textContent = settings.quietGate;
  paintRange(els.workVol); paintRange(els.breakVol); paintRange(els.cueVol); paintRange(els.cuePitch); paintRange(els.cueTone); paintRange(els.vizIntensity); paintRange(els.quietGate); paintRange(els.raveCd);
}
function readForm() {
  settings = { ...settings,                       // keep theme + masterVol (not in modal)
    workUrl: els.workUrl.value.trim(), breakUrl: els.breakUrl.value.trim(),
    workMin: clampInt(els.workMin.value, 1, 180, 35), shortMin: clampInt(els.shortMin.value, 1, 120, 5),
    longMin: clampInt(els.longMin.value, 1, 120, 10), cycles: clampInt(els.cycles.value, 1, 12, 3),
    workVol: clampInt(els.workVol.value, 0, 100, 80), breakVol: clampInt(els.breakVol.value, 0, 100, 80),
    cueVol: clampInt(els.cueVol.value, 0, 100, 80), cuePitch: clampInt(els.cuePitch.value, -12, 12, 2), cueTone: clampInt(els.cueTone.value, 0, 100, 0),
    showVideo: els.showVideo.checked, showViz: els.showViz.checked, reactToAudio: els.reactToAudio.checked,
    calmParticles: els.calmParticles.checked, vizIntensity: clampInt(els.vizIntensity.value, 0, 100, 80),
    quietGate: clampInt(els.quietGate.value, 0, 100, 10),
    rave: els.rave.checked, raveCd: clampInt(els.raveCd.value, 1, 30, 3), raveFull: els.raveFull.checked };
}
