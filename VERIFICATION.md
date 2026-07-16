# Phase 3 — Self-verification

**Model:** Cursor Grok 4.5 (`grok-4.5`)  
**Date:** 2026-07-16

| # | Criterion | Result | Notes |
|---|-----------|--------|-------|
| 1 | Load OK + offline fallback | PASS | App boots with no module errors after flights.js syntax fix. Fallback path + banner implemented; embedded TLEs/aircraft used when network/CORS/rate-limit fails. |
| 2 | 8 planets, distinct periods, warp | PASS | Periods from real day counts; warp slider 1×–50,000× drives solar motion only. |
| 3 | Smooth Earth transition &lt; ~3s | PASS | 2.4s cubic ease; single scene; Earth detail co-located during approach. Observed mode flip to `earth` in smoke test. |
| 4 | ISS labeled + lat/lon plausible | PASS | Live stations TLE + SGP4. Smoke test: ISS ~43.67°N, 139.84°W, alt ~428 km (LEO). Popup includes wheretheiss.at cross-check when reachable. |
| 5 | ≥500 Starlink + instancing | PASS (fallback) / PARTIAL (live) | `InstancedMesh`, default cap 800. Live CelesTrak `GROUP=starlink` returned **403** from this IP (“GP data has not updated since your last successful download”). App falls back to **550** SGP4-valid cached Starlink TLEs, labeled as cached. When CelesTrak allows, live catalog is used. |
| 6 | Correct instance picking | PASS (by design) | `intersection.instanceId` → `pickMeta[id]`; selected instance scaled. |
| 7 | Sat popup fields from TLE/SGP4 | PASS | name, NORAD, group, alt, vel, period, inc, lat/lon from propagate extras. |
| 8 | Flight layer + smooth motion | PASS | Live via **airplanes.live** (adsb.lol tried first). Smoke test: 44 aircraft over Delhi focus, 12s poll, dead-reckon between polls. |
| 9 | Compliant flight poll rate | PASS | `POLL_MS = 12000`. TLE once per group/session + localStorage. |
| 10 | Touch + 44px UI | PASS | OrbitControls touches; CSS `--ui-min: 44px`. |
| 11 | Warp vs real-time layers | PASS | Warp only advances solar `updateSolarSystem`; sats/flights use `Date.now()`. |
| 12 | Graceful degradation banner | PASS | Banner text from `FALLBACK_META` / rate-limit note when any sat group is non-live. |
| 13 | No API keys | PASS | None required. |

## Honest limitations

- **CelesTrak Starlink 403** hit during verification on this network; stations/GPS/OneWeb were live. Starlink rendered from labeled cached snapshot (550).
- **adsb.lol** did not succeed in-browser on first chain hop during smoke test; **airplanes.live** did (still open, no key).
- OpenSky is not used as primary (OAuth2 / IP blocks as of 2026).
- Planet sizes/distances are stylized (labeled in UI).

## Smoke-test evidence (2026-07-16)

```
mode: earth
fps: ~120 (desktop)
sources: { stations: live, gps-ops: live, oneweb: live, starlink: fallback }
flights: { live: true, source: airplanes.live, count: 44, pollMs: 12000 }
iss: { lat: 43.67, lon: -139.84, altKm: 428.35 }
```
