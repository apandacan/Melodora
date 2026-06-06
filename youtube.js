"use strict";
// ================= YouTube =================
function parseYouTube(url) {
  if (!url) return null;
  url = url.trim();
  let videoId = null, listId = null;
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) videoId = u.pathname.slice(1).split('/')[0] || null;
    else { videoId = u.searchParams.get('v'); const m = u.pathname.match(/\/(embed|shorts|live|v)\/([^/?]+)/); if (m) videoId = m[2]; }
    listId = u.searchParams.get('list');
  } catch { if (/^[\w-]{11}$/.test(url)) videoId = url; }
  if (!videoId && !listId) return null;
  return { videoId, listId };
}
let workPlayer, breakPlayer, apiReady = false, workSrc = null, breakSrc = null;
let workLoaded = null, breakLoaded = null;       // videoId/listId currently loaded in each player
let sessionRestore = null, lastSave = 0;          // pending restore positions + save throttle
function parseSrc() { workSrc = parseYouTube(settings.workUrl); breakSrc = parseYouTube(settings.breakUrl); }

const ytTag = document.createElement('script'); ytTag.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(ytTag);
const PV = { autoplay: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3 };
window.onYouTubeIframeAPIReady = function () {
  workPlayer  = new YT.Player('workPlayer',  { playerVars: PV, events: { onReady: () => { apiReady = true; maybeCueRestored(); }, onStateChange: e => loopIfEnded(e, workPlayer) } });
  breakPlayer = new YT.Player('breakPlayer', { playerVars: PV, events: { onReady: () => maybeCueRestored(), onStateChange: e => loopIfEnded(e, breakPlayer) } });
};
function loopIfEnded(e, p) { if (e.data === YT.PlayerState.ENDED) { try { p.seekTo(0); p.playVideo(); } catch {} } }   // reached the end → loop

const audioMode = () => mode === 'work' ? 'work' : 'break';
const activePlayer = () => audioMode() === 'work' ? workPlayer : breakPlayer;
const activeTrackVol = () => audioMode() === 'work' ? settings.workVol : settings.breakVol;
const activeSrc = () => audioMode() === 'work' ? workSrc : breakSrc;
function applyVol(player, trackVol) { try { player && player.setVolume(Math.round((trackVol || 0) * (settings.masterVol || 0) / 100)); } catch {} }

function showActiveFrame() {
  const aw = audioMode();
  els.frameWork.classList.toggle('active', aw === 'work');
  els.frameBreak.classList.toggle('active', aw === 'break');
}
const srcKey = src => src ? (src.listId || src.videoId) : null;
const loadedFor = which => which === 'work' ? workLoaded : breakLoaded;
function setLoaded(which, id) { if (which === 'work') workLoaded = id; else breakLoaded = id; }

// Play the active mode's track. If its video is already loaded it RESUMES from where it was
// (so cycling work→break→work doesn't restart the music); otherwise it loads it once.
function playActive(opts) {
  opts = opts || {};
  const which = audioMode();
  const on = which === 'work' ? workPlayer : breakPlayer;
  const off = which === 'work' ? breakPlayer : workPlayer;
  const src = which === 'work' ? workSrc : breakSrc;
  const vol = which === 'work' ? settings.workVol : settings.breakVol;
  try { off && off.pauseVideo(); } catch {}
  showActiveFrame();
  if (!on || !src) return;
  const key = srcKey(src);
  try {
    if (opts.muted) on.mute(); else { on.unMute(); applyVol(on, vol); }
    if (loadedFor(which) !== key) {
      if (src.listId) on.loadPlaylist({ list: src.listId, listType: 'playlist' });
      else on.loadVideoById({ videoId: src.videoId, startSeconds: opts.startSeconds || 0 });
      setLoaded(which, key);
    } else {
      if (opts.fromZero) { try { on.seekTo(0, true); } catch {} }
      on.playVideo();                          // resume from current / cued position
    }
  } catch {}
}
function pauseAudio() { try { workPlayer && workPlayer.pauseVideo(); } catch {} try { breakPlayer && breakPlayer.pauseVideo(); } catch {} }

// ---- bottom scrubber: reflects + seeks the active track ----
let scrubDragging = false, lastScrub = 0;
function activeDuration() { const p = activePlayer(); try { return (p && p.getDuration) ? (p.getDuration() || 0) : 0; } catch { return 0; } }
function updateScrubber() {
  if (scrubDragging) return;
  const p = activePlayer(); let frac = 0;
  try { const d = activeDuration(), c = (p && p.getCurrentTime) ? (p.getCurrentTime() || 0) : 0; if (d > 0) frac = clamp01(c / d); } catch {}
  els.scrubFill.style.width = (frac * 100).toFixed(2) + '%';
}
function seekToFrac(frac) { const p = activePlayer(), d = activeDuration(); try { if (d > 0 && p && p.seekTo) p.seekTo(frac * d, true); } catch {} }
function scrubFrac(e) { const r = els.scrubber.getBoundingClientRect(); return clamp01((e.clientX - r.left) / r.width); }
function cueAt(player, src, pos) {
  if (!player || !src) return;
  try { if (src.listId) player.cuePlaylist({ list: src.listId, listType: 'playlist' });
        else player.cueVideoById({ videoId: src.videoId, startSeconds: pos || 0 }); } catch {}
}
// After a refresh: cue each track at its saved position so resuming continues where you left off.
function maybeCueRestored() {
  if (!sessionRestore) return;
  cueAt(workPlayer, workSrc, sessionRestore.workPos); if (workSrc) workLoaded = srcKey(workSrc);
  cueAt(breakPlayer, breakSrc, sessionRestore.breakPos); if (breakSrc) breakLoaded = srcKey(breakSrc);
  showActiveFrame();
}

// ---- Session persistence (survive a page refresh) ----
const SKEY = 'melodora.session';
function saveSession() {
  if (PH !== 'run' && PH !== 'paused') return;
  const rem = PH === 'run' ? Math.max(0, endTs - perf()) : remainingMs;
  let wp = 0, bp = 0;
  try { wp = (workPlayer && workPlayer.getCurrentTime && workPlayer.getCurrentTime()) || 0; } catch {}
  try { bp = (breakPlayer && breakPlayer.getCurrentTime && breakPlayer.getCurrentTime()) || 0; } catch {}
  try { localStorage.setItem(SKEY, JSON.stringify({ v: 1, mode, shortCount, remainingMs: rem, workPos: wp, breakPos: bp, ts: Date.now() })); } catch {}
}
function clearSession() { try { localStorage.removeItem(SKEY); } catch {} }
function restoreSession() {
  let s; try { s = JSON.parse(localStorage.getItem(SKEY)); } catch { s = null; }
  if (!s || !s.remainingMs || s.remainingMs <= 0) return false;
  if (Date.now() - (s.ts || 0) > 12 * 3600 * 1000) { clearSession(); return false; }   // ignore stale (>12h)
  mode = s.mode || 'work'; shortCount = s.shortCount || 0; remainingMs = s.remainingMs;
  sessionRestore = { workPos: s.workPos || 0, breakPos: s.breakPos || 0 };
  PH = 'paused'; setFull(); vizAmp = 0; showActiveFrame(); maybeCueRestored();
  setNormalTime(remainingMs); updateModeLabel(); updateButtons(); renderDots();
  return true;
}
