import * as THREE from 'three';
import { latLonAltToVec3 } from './earth-layer.js';
import { FALLBACK_AIRCRAFT, FALLBACK_META } from './fallback-data.js';

const POLL_MS = 12000;
const DEFAULT_FOCUS = { lat: 28.6139, lon: 77.209, name: 'Delhi' };
const RADIUS_NM = 150;

export class FlightLayer {
  constructor(parent) {
    this.parent = parent;
    this.group = new THREE.Group();
    this.group.name = 'flights';
    parent.add(this.group);

    this.focus = { ...DEFAULT_FOCUS };
    this.live = false;
    this.source = 'none';
    this.aircraft = new Map(); // hex -> state
    this.enabled = true;
    this._timer = null;
    this._fetching = false;
    this._geo = new THREE.ConeGeometry(0.012, 0.04, 5);
    this._geo.rotateX(Math.PI / 2);
    this._mat = new THREE.MeshBasicMaterial({ color: 0xffc857 });
    this._selected = null;
  }

  async initFocus() {
    try {
      const pos = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('no geo'));
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
      });
      this.focus = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        name: 'Your location',
      };
    } catch {
      this.focus = { ...DEFAULT_FOCUS };
    }
  }

  setEnabled(on) {
    this.enabled = on;
    this.group.visible = on;
    if (on) this.start();
    else this.stop();
  }

  start() {
    if (this._timer) return;
    this.poll();
    this._timer = setInterval(() => this.poll(), POLL_MS);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  async poll() {
    if (!this.enabled || this._fetching || document.visibilityState === 'hidden') return;
    this._fetching = true;
    try {
      const list = await this._fetchChain();
      this._ingest(list, this.live);
    } catch {
      this._ingest(FALLBACK_AIRCRAFT, false);
      this.live = false;
      this.source = 'cached';
    } finally {
      this._fetching = false;
    }
  }

  async _fetchChain() {
    const { lat, lon } = this.focus;
    const attempts = [
      {
        name: 'adsb.lol',
        url: `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${RADIUS_NM}`,
      },
      {
        name: 'airplanes.live',
        url: `https://api.airplanes.live/v2/point/${lat}/${lon}/${RADIUS_NM}`,
      },
    ];

    for (const a of attempts) {
      try {
        const res = await fetch(a.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const ac = normalizeAircraft(data);
        if (!ac.length) throw new Error('empty');
        this.live = true;
        this.source = a.name;
        return ac;
      } catch {
        // try next
      }
    }
    this.live = false;
    this.source = 'cached';
    return FALLBACK_AIRCRAFT;
  }

  _ingest(list, live) {
    const now = performance.now();
    const seen = new Set();
    for (const raw of list) {
      const hex = (raw.hex || raw.icao || '').toLowerCase();
      if (!hex) continue;
      seen.add(hex);
      const lat = Number(raw.lat);
      const lon = Number(raw.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const altFt = Number(raw.alt_baro ?? raw.alt_geom ?? raw.altitude ?? 0);
      const altKm = (Number.isFinite(altFt) ? altFt : 0) * 0.0003048;
      const gs = Number(raw.gs ?? raw.speed ?? 0) || 0;
      const track = Number(raw.track ?? raw.true_heading ?? raw.heading ?? 0) || 0;
      const callsign = (raw.flight || raw.callsign || hex).toString().trim();
      const country = raw.country || raw.flag || '—';

      let state = this.aircraft.get(hex);
      if (!state) {
        const mesh = new THREE.Mesh(this._geo, this._mat.clone());
        mesh.userData.hex = hex;
        mesh.userData.kind = 'aircraft';
        this.group.add(mesh);
        state = { mesh, hex };
        this.aircraft.set(hex, state);
      }

      state.callsign = callsign;
      state.country = country;
      state.fromLat = state.lat ?? lat;
      state.fromLon = state.lon ?? lon;
      state.fromAltKm = state.altKm ?? Math.max(altKm, 0.5);
      state.targetLat = lat;
      state.targetLon = lon;
      state.targetAltKm = Math.max(altKm, 0.5);
      state.gs = gs;
      state.track = track;
      state.pollTime = now;
      state.live = live;
      if (state.lat == null) {
        state.lat = lat;
        state.lon = lon;
        state.altKm = state.targetAltKm;
        state.fromLat = lat;
        state.fromLon = lon;
        state.fromAltKm = state.targetAltKm;
      }
      state.blend = 0;
    }

    for (const [hex, state] of this.aircraft) {
      if (!seen.has(hex)) {
        this.group.remove(state.mesh);
        state.mesh.geometry = null;
        this.aircraft.delete(hex);
      }
    }
  }

  update(dt) {
    if (!this.enabled) return;
    for (const state of this.aircraft.values()) {
      // Soft blend toward last poll for ~1s, then dead-reckon
      if (state.blend < 1) {
        state.blend = Math.min(1, state.blend + dt / 1.0);
        state.lat = lerp(state.fromLat, state.targetLat, state.blend);
        state.lon = lerp(state.fromLon, state.targetLon, state.blend);
        state.altKm = lerp(state.fromAltKm, state.targetAltKm, state.blend);
      } else {
        // Dead-reckon with ground speed + heading between polls
        const distNm = state.gs * (dt / 3600);
        const distDegLat = distNm / 60;
        const rad = (state.track * Math.PI) / 180;
        state.lat += distDegLat * Math.cos(rad);
        const cosLat = Math.cos((state.lat * Math.PI) / 180) || 1e-6;
        state.lon += (distDegLat * Math.sin(rad)) / cosLat;
      }

      latLonAltToVec3(state.lat, state.lon, state.altKm, state.mesh.position);
      state.mesh.rotation.y = THREE.MathUtils.degToRad(-state.track);
      const sel = this._selected === state.hex;
      state.mesh.scale.setScalar(sel ? 1.8 : 1);
    }
  }

  getPickables() {
    return [...this.aircraft.values()].map((a) => a.mesh);
  }

  resolveHit(hit) {
    const hex = hit.object.userData.hex;
    const state = this.aircraft.get(hex);
    if (!state) return null;
    this._selected = hex;
    return {
      title: state.callsign || hex,
      kind: 'aircraft',
      rows: [
        ['Callsign', state.callsign || '—'],
        ['ICAO hex', state.hex],
        ['Altitude', `${Math.round(state.altKm / 0.0003048)} ft`],
        ['Ground speed', `${Math.round(state.gs)} kt`],
        ['Heading', `${Math.round(state.track)} deg`],
        ['Origin country', state.country || '-'],
        ['Lat / Lon', `${state.lat.toFixed(3)}, ${state.lon.toFixed(3)}`],
        ['Data', state.live ? `Live ADS-B (${this.source})` : FALLBACK_META.label],
        ['Focus region', `${this.focus.name} · ${RADIUS_NM} nm`],
      ],
    };
  }

  getStatus() {
    return {
      live: this.live,
      source: this.source,
      count: this.aircraft.size,
      focus: this.focus,
      pollMs: POLL_MS,
      note: this.live ? null : FALLBACK_META.note,
    };
  }
}

function normalizeAircraft(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.ac)) return data.ac;
  if (Array.isArray(data.aircraft)) return data.aircraft;
  return [];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
