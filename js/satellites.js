import * as THREE from 'three';
import { FALLBACK_TLES, FALLBACK_META } from './fallback-data.js';
import { EARTH_RADIUS, EARTH_RADIUS_KM } from './earth-layer.js';

const GROUPS = [
  { id: 'stations', endpoint: 'stations', color: 0xffdd66 },
  { id: 'starlink', endpoint: 'starlink', color: 0x6ec8ff },
  { id: 'gps-ops', endpoint: 'gps-ops', color: 0x8dff9a },
  { id: 'oneweb', endpoint: 'oneweb', color: 0xff9e6e },
];

const CACHE_KEY = 'lss_tle_cache_v2';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const ISS_NORAD = 25544;

export class SatelliteLayer {
  constructor(parent) {
    this.parent = parent;
    this.group = new THREE.Group();
    this.group.name = 'satellites';
    parent.add(this.group);

    this.meta = [];
    this.live = false;
    this.sourceNote = '';
    this.issEnrichment = null;
    this.starlinkLimit = 800;
    this.layersOn = { starlink: true, gps: true, oneweb: true, stations: true };

    this.meshes = {};
    this.issMesh = null;
    this.selectedNorad = null;
    this._tmp = new THREE.Object3D();
    this._color = new THREE.Color();
    this._lastExtras = null;
    this._workerBusy = false;
    this._pendingTime = null;

    this.worker = new Worker(new URL('./sgp4-worker.js', import.meta.url));
    this.worker.onmessage = (ev) => this._onWorker(ev.data);

    const geo = new THREE.OctahedronGeometry(0.018, 0);
    for (const g of GROUPS) {
      if (g.id === 'stations') continue;
      const mat = new THREE.MeshBasicMaterial({ color: g.color });
      const mesh = new THREE.InstancedMesh(geo, mat, 8000);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.userData.group = g.id;
      mesh.userData.pickMeta = [];
      this.meshes[g.id] = mesh;
      this.group.add(mesh);
    }

    this.issMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.02, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xfff2a8 })
    );
    this.issMesh.name = 'ISS';
    this.issMesh.userData.isIss = true;
    this.issMesh.visible = false;
    this.group.add(this.issMesh);
  }

  setStarlinkLimit(value) {
    if (value === 'all') this.starlinkLimit = 8000;
    else this.starlinkLimit = Number(value) || 800;
    this._rebuildInstanceMapping();
  }

  setLayerVisible(key, on) {
    const map = { starlink: 'starlink', gps: 'gps-ops', oneweb: 'oneweb' };
    if (key === 'starlink' || key === 'gps' || key === 'oneweb') {
      const gid = map[key];
      this.layersOn[gid] = on;
      if (this.meshes[gid]) this.meshes[gid].visible = on;
    }
  }

  async load() {
    const blocks = [];
    const sources = {};
    const cached = readCache(); // may include expired entries for rate-limit recovery
    const freshCache = {};

    for (const g of GROUPS) {
      let text = null;
      let source = 'fallback';

      // 1) Prefer in-memory session / fresh localStorage (< 6h)
      if (cached?.fresh && cached.groups?.[g.endpoint] && looksLikeTle(cached.groups[g.endpoint])) {
        text = cached.groups[g.endpoint];
        source = 'cache';
      } else {
        // 2) Network once per group
        try {
          const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${g.endpoint}&FORMAT=tle`;
          const res = await fetch(url);
          const body = await res.text();
          if (!res.ok || !looksLikeTle(body)) {
            throw new Error(`TLE fetch failed (${res.status})`);
          }
          text = body;
          source = 'live';
          freshCache[g.endpoint] = body;
        } catch {
          // 3) Stale localStorage (CelesTrak 403 "not updated since last download")
          if (cached?.groups?.[g.endpoint] && looksLikeTle(cached.groups[g.endpoint])) {
            text = cached.groups[g.endpoint];
            source = 'stale-cache';
          } else {
            // 4) Embedded snapshot
            text = FALLBACK_TLES[g.endpoint] || FALLBACK_TLES.stations;
            source = 'fallback';
          }
        }
      }

      sources[g.id] = source;
      blocks.push({ group: g.id, text });
    }

    // Merge newly fetched groups into localStorage
    if (Object.keys(freshCache).length) {
      const merged = { ...(cached?.groups || {}), ...freshCache };
      writeCache(merged);
    }

    const allLive = Object.values(sources).every((s) => s === 'live' || s === 'cache');
    const anyFallback = Object.values(sources).some((s) => s === 'fallback' || s === 'stale-cache');
    this.live = allLive && !anyFallback;
    this.groupSources = sources;

    if (this.live) {
      this.sourceNote = 'Live TLEs from CelesTrak (session-cached)';
    } else if (Object.values(sources).some((s) => s === 'stale-cache')) {
      this.sourceNote = 'Live data unavailable — showing cached snapshot (CelesTrak rate-limit/stale cache)';
    } else {
      this.sourceNote = FALLBACK_META.note;
    }

    await this._setCatalog(blocks);

    try {
      const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
      if (r.ok) this.issEnrichment = await r.json();
    } catch {
      this.issEnrichment = null;
    }

    return {
      live: this.live,
      note: this.sourceNote,
      count: this.meta.length,
      sources,
    };
  }

  _setCatalog(blocks) {
    return new Promise((resolve) => {
      const onReady = (ev) => {
        if (ev.data.type !== 'catalogReady') return;
        this.worker.removeEventListener('message', onReady);
        this.meta = ev.data.meta;
        this._rebuildInstanceMapping();
        resolve();
      };
      this.worker.addEventListener('message', onReady);
      this.worker.postMessage({ type: 'setCatalog', blocks });
    });
  }

  _rebuildInstanceMapping() {
    this.groupIndex = { starlink: [], 'gps-ops': [], oneweb: [], stations: [] };
    for (let i = 0; i < this.meta.length; i++) {
      const m = this.meta[i];
      const g = m.group;
      if (!this.groupIndex[g]) this.groupIndex[g] = [];
      this.groupIndex[g].push(i);
    }

    // Cap starlink
    const sl = this.groupIndex.starlink || [];
    this.starlinkRenderIdx = sl.slice(0, this.starlinkLimit);

    for (const gid of ['starlink', 'gps-ops', 'oneweb']) {
      const mesh = this.meshes[gid];
      if (!mesh) continue;
      const idxs = gid === 'starlink' ? this.starlinkRenderIdx : this.groupIndex[gid] || [];
      mesh.userData.catalogIndices = idxs;
      mesh.userData.pickMeta = idxs.map((ci) => this.meta[ci]);
      mesh.count = idxs.length;
    }
  }

  requestPropagate(timeMs) {
    if (document.visibilityState === 'hidden') return;
    if (this._workerBusy) {
      this._pendingTime = timeMs;
      return;
    }
    this._workerBusy = true;
    this.worker.postMessage({ type: 'propagate', timeMs });
  }

  _onWorker(data) {
    if (data.type !== 'positions') return;
    this._workerBusy = false;
    this._applyPositions(data.positions, data.extras, data.count);
    if (this._pendingTime != null) {
      const t = this._pendingTime;
      this._pendingTime = null;
      this.requestPropagate(t);
    }
  }

  _applyPositions(positionsKm, extras, count) {
    this._lastExtras = extras;
    const scale = EARTH_RADIUS / EARTH_RADIUS_KM;

    for (const gid of ['starlink', 'gps-ops', 'oneweb']) {
      const mesh = this.meshes[gid];
      const idxs = mesh.userData.catalogIndices || [];
      for (let i = 0; i < idxs.length; i++) {
        const ci = idxs[i];
        const valid = extras[ci * 5 + 4];
        if (!valid) {
          this._tmp.position.set(0, 0, 0);
          this._tmp.scale.set(0, 0, 0);
        } else {
          this._tmp.position.set(
            positionsKm[ci * 3] * scale,
            positionsKm[ci * 3 + 1] * scale,
            positionsKm[ci * 3 + 2] * scale
          );
          const selected = this.meta[ci]?.norad === this.selectedNorad;
          const s = selected ? 2.2 : 1;
          this._tmp.scale.set(s, s, s);
        }
        this._tmp.updateMatrix();
        mesh.setMatrixAt(i, this._tmp.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    // ISS
    const issIdx = this.meta.findIndex((m) => m.norad === ISS_NORAD);
    if (issIdx >= 0 && extras[issIdx * 5 + 4]) {
      this.issMesh.visible = true;
      this.issMesh.position.set(
        positionsKm[issIdx * 3] * scale,
        positionsKm[issIdx * 3 + 1] * scale,
        positionsKm[issIdx * 3 + 2] * scale
      );
      this.issState = {
        ...this.meta[issIdx],
        lat: extras[issIdx * 5],
        lon: extras[issIdx * 5 + 1],
        altKm: extras[issIdx * 5 + 2],
        velKmS: extras[issIdx * 5 + 3],
      };
    }
  }

  getPickables() {
    return Object.values(this.meshes).filter((m) => m.visible && m.count > 0).concat(this.issMesh.visible ? [this.issMesh] : []);
  }

  resolveHit(hit) {
    if (hit.object === this.issMesh) {
      return this.buildPopupForNorad(ISS_NORAD);
    }
    const mesh = hit.object;
    const id = hit.instanceId;
    if (id == null) return null;
    const meta = mesh.userData.pickMeta?.[id];
    if (!meta) return null;
    return this.buildPopupForNorad(meta.norad);
  }

  buildPopupForNorad(norad) {
    const idx = this.meta.findIndex((m) => m.norad === norad);
    if (idx < 0) return null;
    const m = this.meta[idx];
    const ex = this._lastExtras;
    const lat = ex ? ex[idx * 5] : null;
    const lon = ex ? ex[idx * 5 + 1] : null;
    const alt = ex ? ex[idx * 5 + 2] : null;
    const vel = ex ? ex[idx * 5 + 3] : null;
    this.selectedNorad = norad;

    const rows = [
      ['Name', m.name],
      ['NORAD ID', m.norad],
      ['Operator / constellation', m.group],
      ['Altitude', alt != null ? `${alt.toFixed(1)} km` : '—'],
      ['Velocity', vel != null ? `${vel.toFixed(2)} km/s` : '—'],
      ['Orbital period', m.periodMin != null ? `${m.periodMin.toFixed(1)} min` : '—'],
      ['Inclination', m.inclination != null ? `${m.inclination.toFixed(2)}°` : '—'],
      ['Latitude', lat != null ? `${lat.toFixed(3)}°` : '—'],
      ['Longitude', lon != null ? `${lon.toFixed(3)}°` : '—'],
      ['Data', this.live ? 'Live TLE + SGP4' : FALLBACK_META.label],
    ];

    if (norad === ISS_NORAD) {
      if (this.issEnrichment) {
        rows.push(['ISS cross-check (wheretheiss.at)', `${Number(this.issEnrichment.latitude).toFixed(3)}°, ${Number(this.issEnrichment.longitude).toFixed(3)}°`]);
        rows.push(['Visibility / velocity note', `API vel ${Number(this.issEnrichment.velocity).toFixed(2)} km/h`]);
      }
      rows.push(['Crew note', 'Typical ISS expedition crew ≈ 7 (static enrichment if no free crew API)']);
    }

    return { title: m.name, rows, norad, kind: 'satellite' };
  }

  search(query) {
    if (!query) return null;
    const q = query.toLowerCase();
    const hit = this.meta.find((m) => m.name.toLowerCase().includes(q) || String(m.norad).includes(q));
    if (!hit) return null;
    return this.buildPopupForNorad(hit.norad);
  }

  getIssWorldPosition(target) {
    if (!this.issMesh.visible) return null;
    return this.issMesh.getWorldPosition(target);
  }

  dispose() {
    this.worker.terminate();
  }
}

function looksLikeTle(text) {
  return typeof text === 'string' && text.includes('1 ') && text.includes('2 ');
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const age = Date.now() - (data.fetchedAt || 0);
    return { ...data, fresh: age <= CACHE_TTL_MS, age };
  } catch {
    return null;
  }
}

function writeCache(groups) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), groups }));
  } catch {
    // quota — Starlink TLEs can be large
  }
}
