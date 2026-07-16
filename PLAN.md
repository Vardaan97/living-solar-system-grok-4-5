# Living Solar System — Phase 1 Plan

**Model:** Cursor Grok 4.5  
**Benchmark tag:** `grok-4.5`

## 1. Architecture decision

**Packaging: small multi-file static app** (not one mega-HTML), runnable with one command:

| File | Role |
|------|------|
| `index.html` | Shell, CSS UI chrome, CDN import map |
| `js/main.js` | Boot, scene graph, camera modes, UI wiring |
| `js/solar-system.js` | Sun, 8 planets, orbits, materials, time clock |
| `js/earth-layer.js` | Earth detail, atmosphere, lat/lon ↔ ECEF helpers |
| `js/satellites.js` | TLE fetch/cache, worker bridge, InstancedMesh, ISS label |
| `js/flights.js` | ADS-B fetch chain, dead-reckon, aircraft markers |
| `js/picking.js` | Raycast + instanceId mapping, popup model |
| `js/ui.js` | Controls, banners, attribution, FPS |
| `js/sgp4-worker.js` | satellite.js propagation off main thread |
| `js/fallback-data.js` | Embedded cached TLEs (~ISS + ~50 sats) + ~20 aircraft |

**Why not single-file:** a Web Worker must load `satellite.js` and process thousands of TLEs without blocking the UI. Multi-file stays trivially runnable via `npx --yes serve .` or `python3 -m http.server`.

**CDN imports:** Three.js (r170+), `OrbitControls`, `satellite.js`.

**Scene graph:** one continuous world — `solarSystemGroup` → planets → `EarthPivot` → `earthLocalGroup` (sats/flights). No second Scene, no page reload on zoom-to-Earth.

**Renderer:** `logarithmicDepthBuffer: true`, capped pixel ratio (1.5 desktop / 1.25 mobile).

## 2. Scale strategy

| Regime | Unit meaning | Camera distance |
|--------|--------------|-----------------|
| Solar | 1 AU ≈ 80 scene units; planet radii exaggerated (labeled not to scale) | ~40–200 from Sun |
| Earth-orbit | Earth radius Rₑ = 1.0; LEO via `Rₑ * (1 + alt_km/6371)` | ~1.5–8 Rₑ |

Transition ≤ ~2.5s with cubic ease; reparent Earth to `focusAnchor` at origin in Earth mode; tighten near/far; hide distant solar clutter.

## 3. Data pipeline

**TLE (once per group per session):** CelesTrak `stations`, `starlink`, `gps-ops`, `oneweb`. Cache memory + localStorage (6h). SGP4 in Web Worker via satellite.js. ISS enrichment optional via wheretheiss.at.

**Flights:** adsb.lol → airplanes.live → embedded snapshot. Poll every **12s**, region ≤150 nm, default Delhi. Dead-reckon between polls.

## 4. Performance budget

Default 800 Starlink (InstancedMesh), presets 500/1500/3000/All. Target ≥30 FPS mid-range phone. Worker chunking; DPR cap.

## 5. Interaction

Raycaster `instanceId` → meta array. OrbitControls touch: one-finger rotate, two-finger pinch. Warp applies to solar clock only; Earth layers use wall-clock UTC.

## 6. Risk register

CORS / rate limits / mobile GPU / TLE parse / picking — mitigated by fallback banner, one-shot TLE fetch, density presets, skip bad TLEs, instanceId mapping.

## 7. Self-test checklist

See `VERIFICATION.md` (Phase 3). Full acceptance criteria from the mission brief.

## Defaults

Delhi focus if no geolocation; Starlink default 800; GPS + OneWeb; warp solar-only; multi-file + static server.
