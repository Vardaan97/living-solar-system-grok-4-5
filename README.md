# Living Solar System

**Benchmark build: Cursor Grok 4.5** (`grok-4.5`)

Interactive Three.js solar system with a seamless zoom into Earth, live SGP4 satellite orbits (CelesTrak TLEs), and an FR24-style aircraft layer from open ADS-B APIs.

## Run

Serve the folder over HTTP (ES modules + Web Worker require a local server):

```bash
cd "Solar Grok"
npx --yes serve .
# or: python3 -m http.server 3000
```

Open the printed URL (usually `http://localhost:3000`).

No API keys required.

## Features

- Sun + 8 planets with orbit paths, spin, and time warp (1×–50,000×, solar view)
- Seamless camera transition into Earth view
- Live TLEs: stations (ISS), Starlink, GPS operational, OneWeb — fetched once per session, SGP4 in a Web Worker
- Live aircraft via `adsb.lol` → `airplanes.live` → embedded cached snapshot (12s poll)
- Instanced rendering, density presets, layer toggles, satellite search, info popups
- Offline / CORS resilience with a clear banner

## Model attribution

| Field | Value |
|-------|--------|
| Model | Cursor Grok 4.5 |
| Tag | `grok-4.5` |
| Plan | [`PLAN.md`](PLAN.md) |
| Self-test | [`VERIFICATION.md`](VERIFICATION.md) |

## Credits

- [CelesTrak](https://celestrak.org/) — GP / TLE elements
- [adsb.lol](https://adsb.lol/) / [airplanes.live](https://airplanes.live/) — open ADS-B
- [wheretheiss.at](https://wheretheiss.at/) — ISS cross-check
- [Three.js](https://threejs.org/) · [satellite.js](https://github.com/shashwatak/satellite-js)
