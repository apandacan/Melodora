# Melodora

A music-based Pomodoro timer. Set a YouTube link for **focus** music and one for **break** music; Melodora plays the right track for each phase and switches hands-free, so you can keep your headphones on and know the mode by ear.

Features:
- Centered timer with customizable work / short-break / long-break lengths
- Audio-reactive canvas visualizer (reacts to this tab's real audio via Meyda, or a simulated signal)
- Transition chimes and "rave lights" on intense parts of a song
- A coin-earning **Customize** shop: particle / ring / ripple shapes, colors (incl. an animated rainbow), display fonts, and premium theme packs — unlocked with coins or by reaching session milestones

## Run locally
No build step — it's plain static files. Serve the folder over HTTP (use `localhost`, **not** `file://`, so the visualizer's tab-audio capture works in a secure context):

```sh
py -m http.server 8200        # or:  npx --yes serve -l 8200
```

then open <http://localhost:8200>.

## Structure
- `index.html` — markup (DOM + the settings/shop modals)
- `styles.css` — all CSS
- seven classic scripts loaded in order (do not reorder): `settings.js` → `youtube.js` → `audio.js` → `visuals.js` → `timer.js` → `shop.js` → `main.js`

External dependencies load from CDNs at runtime (YouTube IFrame API, Meyda, Google Fonts, DSEG7) — internet required; the app degrades gracefully offline.
