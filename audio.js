"use strict";
// ================= Web Audio: chimes + optional real-audio analyser =================
let actx = null, masterGain = null;
function ensureAudio() {
  if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) { actx = new AC(); masterGain = actx.createGain(); masterGain.gain.value = 0.9; masterGain.connect(actx.destination); } }
  if (actx && actx.state === 'suspended') actx.resume();
}
// Struck-chime tone: inharmonic bell partials, percussive attack, partials decay faster than the fundamental.
function chime(freq, when = 0, vol = 0.13, dur = 1.4) {
  if (!actx) return;
  const t = actx.currentTime + Math.max(0, when);
  const tone = (settings.cueTone == null ? 50 : settings.cueTone) / 100;   // 0 = pure/warm, 1 = bright/metallic
  const partials = [[1, 1.0, 1.0], [2.0, 0.12 + 0.45 * tone, 0.55], [2.76, 0.18 + 0.65 * tone, 0.42], [5.4, 0.04 + 0.4 * tone, 0.22]];  // ratio, gain, decay×
  for (const [r, g, d] of partials) {
    const o = actx.createOscillator(), gn = actx.createGain();
    o.type = 'sine'; o.frequency.value = freq * r;
    const pd = dur * d;
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol * g, t + 0.005);   // sharp strike
    gn.gain.exponentialRampToValueAtTime(0.0001, t + pd);       // ring out
    o.connect(gn); gn.connect(masterGain);
    o.start(t); o.stop(t + pd + 0.05);
  }
}
// Transition cue — 1·1·2 rhythm (two quarter notes + a held half note).
// Into focus → G3 C3 F3 (whimsical).  Into break → C3 A2 F2 (winding down).
function playTransitionMelody(toWork) {
  if (!actx) return;
  const q = 0.3, lead = 1.6;          // push the phrase so the chord lands right as the timer hits "1" (rings into the next phase)
  const tr = Math.pow(2, (settings.cuePitch == null ? 0 : settings.cuePitch) / 12);   // pitch shift (semitones)
  const notes = (toWork ? [587.33, 392.00, 523.25]   // D5 G4 C5 — into focus (mid register)
                        : [392.00, 329.63, 261.63])   // G4 E4 C4 — into break
                .map(n => n * tr);
  const gain = (settings.cueVol == null ? 80 : settings.cueVol) / 100;
  const vol = (toWork ? 0.20 : 0.18) * gain;
  chime(notes[0], lead,         vol, 0.55);
  chime(notes[1], lead + q,     vol, 0.55);
  chime(notes[2], lead + 2 * q, vol, 0.8);   // half note
  // resolving chord — lands on "1", lingers only briefly
  const chordAt = lead + 4 * q, cv = vol * 0.6;   // ≈ 2.0s into the 3-2-1 → on "1"
  chime(notes[0], chordAt, cv, 1.5);
  chime(notes[1], chordAt, cv, 1.5);
  chime(notes[2], chordAt, cv, 1.5);
}

let analyser = null, timeData = null, realAudioOn = false, captureStream = null, audioAvg = 0, prevRms = 0, realAudioPending = false;
let meydaNode = null, meydaFeatures = null, fluxAvg = 0;
function setupMeyda(sourceNode) {
  meydaNode = null; meydaFeatures = null; fluxAvg = 0;
  if (!window.Meyda || !actx || !sourceNode) return;     // graceful: fall back to in-house RMS if Meyda absent
  try {
    meydaNode = Meyda.createMeydaAnalyzer({
      audioContext: actx, source: sourceNode, bufferSize: 512,
      featureExtractors: ['rms', 'loudness', 'spectralFlux'],
      callback: f => { meydaFeatures = f; }
    });
    meydaNode.start();
  } catch (e) { meydaNode = null; meydaFeatures = null; }
}
function stopRealAudio() {
  realAudioOn = false;
  if (meydaNode) { try { meydaNode.stop(); } catch {} }
  meydaNode = null; meydaFeatures = null;
  if (captureStream) { try { captureStream.getTracks().forEach(t => t.stop()); } catch {} captureStream = null; }
  analyser = null;
}
async function enableRealAudio() {
  if (realAudioOn || realAudioPending) return false;     // don't stack prompts
  realAudioPending = true;
  try {
    ensureAudio();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) return false;
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, preferCurrentTab: true });
    } catch (e1) {
      // user actively declined → don't pop a second dialog
      if (e1 && (e1.name === 'NotAllowedError' || e1.name === 'AbortError' || e1.name === 'NotFoundError')) throw e1;
      // option unsupported by this browser → retry without preferCurrentTab
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    }
    const aTracks = stream.getAudioTracks();
    if (!aTracks.length) { stream.getTracks().forEach(t => t.stop()); return false; }
    captureStream = stream;
    const src = actx.createMediaStreamSource(stream);
    analyser = actx.createAnalyser(); analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.6;
    timeData = new Uint8Array(analyser.fftSize);
    src.connect(analyser);
    setupMeyda(src);
    stream.getVideoTracks().forEach(t => t.stop());
    aTracks[0].addEventListener('ended', stopRealAudio);
    realAudioOn = true; return true;
  } catch { realAudioOn = false; analyser = null; return false; }
  finally { realAudioPending = false; }
}

const N = 96;
// Quiet-part gate, adjustable via settings.quietGate (0 = off → always reactive, 100 = strong → calms readily).
// ratio = current loudness / running-average loudness. Returns 0 (calm) … 1 (full).
function gateFrom(ratio) {
  const g = (settings.quietGate || 0) / 100;
  if (g <= 0.001) return 1;                       // gate off → ring stays reactive even in quiet parts
  const thr = g * 0.9;                            // calm when loudness drops below this fraction of its running average
  return clamp01((ratio - thr) / Math.max(1 - thr, 0.06));
}
// Returns an overall { level, intensity } — volume-driven, NOT frequency-band specific,
// so the ring pulses uniformly instead of bulging where the bass is.
function audioSignal(now) {
  if (realAudioOn) {
    // Preferred: Meyda perceptual loudness (stable in quiet) + spectral flux (clean beat onsets).
    if (meydaFeatures) {
      const f = meydaFeatures;
      const loud = (f.loudness && f.loudness.total) ? f.loudness.total : ((f.rms || 0) * 40);
      audioAvg = audioAvg > 0 ? audioAvg * 0.995 + loud * 0.005 : (loud || 1);
      const ref = Math.max(audioAvg, 1e-3);
      const norm = clamp01(loud / (ref * 1.4));                // beats exceed the running loudness
      const gate = gateFrom(loud / ref);                       // adjustable quiet-part gate
      const level = clamp01(norm * (0.12 + 0.88 * gate));
      const flx = f.spectralFlux || 0;
      fluxAvg = fluxAvg * 0.92 + flx * 0.08;
      const intensity = clamp01((flx - fluxAvg) / (fluxAvg + 1e-3) * 0.7) * gate;
      return { level, intensity };
    }
    // Fallback (no Meyda): RMS from the analyser, same relative-gate idea.
    if (analyser) {
      analyser.getByteTimeDomainData(timeData);
      const n = timeData.length;
      let sumSq = 0;
      for (let i = 0; i < n; i++) { const v = (timeData[i] - 128) / 128; sumSq += v * v; }
      const rms = Math.sqrt(sumSq / n);
      audioAvg = audioAvg > 0 ? audioAvg * 0.995 + rms * 0.005 : (rms || 0.05);
      const ref = Math.max(audioAvg, 0.01);
      const norm = clamp01(rms / (ref * 1.4));
      const gate = gateFrom(rms / ref);
      const level = clamp01(norm * (0.12 + 0.88 * gate));
      const flux = Math.max(0, rms - prevRms); prevRms = rms;
      const intensity = clamp01(flux / (ref * 0.6)) * gate;
      return { level, intensity };
    }
  }
  const t = now / 1000;
  const bpm = 90, beatPhase = (t * bpm / 60) % 1, beat = Math.pow(1 - beatPhase, 2.4);
  const energy = clamp01(0.55 + 0.3 * Math.sin(t * 0.33) + 0.15 * Math.sin(t * 0.12 + 1));
  const level = clamp01(0.38 + 0.4 * beat * energy + 0.12 * Math.sin(t * 1.7));
  return { level, intensity: clamp01(beat * energy) };
}
