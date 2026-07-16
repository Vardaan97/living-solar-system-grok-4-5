import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSolarSystem, updateSolarSystem, createStarfield } from './solar-system.js';
import { createEarthDetail, applyEarthVertexColors } from './earth-layer.js';
import { SatelliteLayer } from './satellites.js';
import { FlightLayer } from './flights.js';
import { Picker, firstHit } from './picking.js';
import { bindUI } from './ui.js';
import { FALLBACK_META } from './fallback-data.js';

const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 800;

const wrap = document.getElementById('canvas-wrap');
const renderer = new THREE.WebGLRenderer({
  antialias: !isMobile,
  logarithmicDepthBuffer: true,
  powerPreference: 'high-performance',
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05080f, 1);
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.05, 5000);
camera.position.set(0, 45, 140);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 8;
controls.maxDistance = 420;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

const starfield = createStarfield(isMobile ? 1400 : 2200);
scene.add(starfield);

const solar = createSolarSystem();
scene.add(solar.root);

const focusAnchor = new THREE.Group();
focusAnchor.name = 'focusAnchor';
scene.add(focusAnchor);

const earthDetail = createEarthDetail();
applyEarthVertexColors(earthDetail.earth);
focusAnchor.add(earthDetail.group);

const satLayer = new SatelliteLayer(earthDetail.group);
const flightLayer = new FlightLayer(earthDetail.group);

let mode = 'solar'; // solar | transitioning | earth
let playing = true;
let warp = 1;
let earthLayersReady = false;
let transition = null;

const clock = new THREE.Clock();
let fpsAccum = 0;
let fpsFrames = 0;
let fpsValue = 0;
let propAccum = 0;

const ui = bindUI({
  goEarth: () => beginEarthTransition(),
  goSolar: () => beginSolarTransition(),
  togglePlay: () => {
    playing = !playing;
    ui.setPlaying(playing);
  },
  setWarp: (w) => {
    warp = w;
  },
  setSatCount: (v) => satLayer.setStarlinkLimit(v),
  searchSat: (q) => {
    const popup = satLayer.search(q);
    if (popup) ui.showPopup(popup.title, popup.rows);
  },
  setLayer: (key, on) => {
    if (key === 'flights') flightLayer.setEnabled(on);
    else if (key === 'orbits') solar.orbitLines.visible = on;
    else if (key === 'labels') {
      /* handled in render via ui.getLayerState */
    } else satLayer.setLayerVisible(key, on);
  },
});

ui.setPlaying(true);

const picker = new Picker(camera, renderer.domElement);
picker.onPick = (raycaster) => {
  if (mode === 'earth' || mode === 'transitioning') {
    const satHit = firstHit(raycaster, satLayer.getPickables());
    if (satHit) {
      const popup = satLayer.resolveHit(satHit);
      if (popup) {
        ui.showPopup(popup.title, popup.rows);
        return;
      }
    }
    const flightHit = firstHit(raycaster, flightLayer.getPickables());
    if (flightHit) {
      const popup = flightLayer.resolveHit(flightHit);
      if (popup) {
        ui.showPopup(popup.title, popup.rows);
        return;
      }
    }
  }
  if (mode === 'solar') {
    const earthMesh = solar.earthEntry?.mesh;
    if (earthMesh) {
      const hits = raycaster.intersectObject(earthMesh, false);
      if (hits.length) beginEarthTransition();
    }
  }
};

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function beginEarthTransition() {
  if (mode === 'earth' || (transition && transition.to === 'earth')) return;
  mode = 'transitioning';
  ui.setMode('Entering Earth…');
  controls.enabled = false;

  const earthMesh = solar.earthEntry.mesh;
  const startPos = camera.position.clone();
  const startTarget = controls.target.clone();
  const earthWorld = new THREE.Vector3();
  earthMesh.getWorldPosition(earthWorld);

  const endTarget = earthWorld.clone();
  const endPos = earthWorld.clone().add(new THREE.Vector3(0, 2.2, 4.5));

  transition = {
    to: 'earth',
    t: 0,
    dur: 2.4,
    startPos,
    endPos,
    startTarget,
    endTarget,
    onMid: false,
  };

  ensureEarthData();
}

function beginSolarTransition() {
  if (mode === 'solar' || (transition && transition.to === 'solar')) return;
  mode = 'transitioning';
  ui.setMode('Leaving Earth…');
  controls.enabled = false;
  flightLayer.stop();

  // Reattach Earth into solar hierarchy if needed
  exitEarthFocus();

  const earthMesh = solar.earthEntry.mesh;
  const earthWorld = new THREE.Vector3();
  earthMesh.getWorldPosition(earthWorld);

  transition = {
    to: 'solar',
    t: 0,
    dur: 2.2,
    startPos: camera.position.clone(),
    endPos: new THREE.Vector3(0, 45, 140),
    startTarget: controls.target.clone(),
    endTarget: new THREE.Vector3(0, 0, 0),
    onMid: false,
  };
}

function enterEarthFocus() {
  // Hide distant solar planets/sun for precision; keep continuous feel via prior tween
  solar.root.visible = false;
  earthDetail.group.visible = true;
  earthDetail.group.position.set(0, 0, 0);

  camera.near = 0.01;
  camera.far = 200;
  camera.updateProjectionMatrix();
  controls.minDistance = 1.35;
  controls.maxDistance = 12;
  controls.target.set(0, 0, 0);
  camera.position.set(0, 1.8, 3.8);

  mode = 'earth';
  ui.setMode('Earth');
  controls.enabled = true;
  if (ui.getLayerState().flights) flightLayer.start();
}

function exitEarthFocus() {
  solar.root.visible = true;
  earthDetail.group.visible = false;
  camera.near = 0.05;
  camera.far = 5000;
  camera.updateProjectionMatrix();
  controls.minDistance = 8;
  controls.maxDistance = 420;
}

async function ensureEarthData() {
  if (earthLayersReady) return;
  ui.setMode('Loading orbits…');
  try {
    await flightLayer.initFocus();
    const satStatus = await satLayer.load();
    const notes = [];
    if (!satStatus.live) notes.push(satStatus.note || FALLBACK_META.note);
    satLayer.requestPropagate(Date.now());
    await flightLayer.poll();
    const f = flightLayer.getStatus();
    if (!f.live) notes.push(f.note || FALLBACK_META.note);
    if (notes.length) {
      ui.showBanner([...new Set(notes)].join(' · '), 'warn');
    } else {
      ui.clearBanner();
    }
    console.info('[LSS] satellite sources', satStatus.sources, 'count', satStatus.count);
    console.info('[LSS] flights', f);
    earthLayersReady = true;
  } catch (err) {
    console.warn('Earth data load failed, using cached snapshot', err);
    ui.showBanner(FALLBACK_META.note, 'warn');
    earthLayersReady = true;
  }
}

function updateTransition(dt) {
  if (!transition) return;
  transition.t += dt;
  const u = Math.min(1, transition.t / transition.dur);
  const e = easeInOutCubic(u);
  camera.position.lerpVectors(transition.startPos, transition.endPos, e);
  controls.target.lerpVectors(transition.startTarget, transition.endTarget, e);

  if (transition.to === 'earth') {
    // Keep Earth detail co-located with the solar Earth during the approach
    const ew = new THREE.Vector3();
    solar.earthEntry.mesh.getWorldPosition(ew);
    earthDetail.group.position.copy(ew);
    if (!transition.onMid && u >= 0.5) {
      transition.onMid = true;
      earthDetail.group.visible = true;
    }
    const fade = Math.max(0, (u - 0.5) / 0.5);
    solar.orbitLines.visible = fade < 0.85 && ui.getLayerState().orbits;
  }

  if (u >= 1) {
    const to = transition.to;
    transition = null;
    if (to === 'earth') {
      enterEarthFocus();
    } else {
      exitEarthFocus();
      mode = 'solar';
      ui.setMode('Solar');
      controls.enabled = true;
      controls.target.set(0, 0, 0);
      solar.orbitLines.visible = ui.getLayerState().orbits;
    }
  }
}

const _issWorld = new THREE.Vector3();
const _issNdc = new THREE.Vector3();

function updateIssLabel() {
  const layers = ui.getLayerState();
  if (mode !== 'earth' || !layers.labels) {
    ui.setIssLabel(false);
    return;
  }
  const p = satLayer.getIssWorldPosition(_issWorld);
  if (!p) {
    ui.setIssLabel(false);
    return;
  }
  _issNdc.copy(p).project(camera);
  if (_issNdc.z > 1) {
    ui.setIssLabel(false);
    return;
  }
  const x = (_issNdc.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-_issNdc.y * 0.5 + 0.5) * window.innerHeight;
  ui.setIssLabel(true, x, y);
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.5));
}

window.addEventListener('resize', onResize);

renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  ui.showBanner('WebGL context lost — waiting to restore…', 'bad');
});
renderer.domElement.addEventListener('webglcontextrestored', () => {
  ui.showBanner('WebGL restored', 'warn');
  setTimeout(() => ui.clearBanner(), 2000);
  onResize();
});

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  fpsAccum += dt;
  fpsFrames += 1;
  if (fpsAccum >= 0.5) {
    fpsValue = Math.round(fpsFrames / fpsAccum);
    ui.setFps(fpsValue);
    fpsAccum = 0;
    fpsFrames = 0;
  }

  if (transition) updateTransition(dt);
  else controls.update();

  // Solar sim clock — warp only affects planets (decoupled from Earth real-time layers)
  if (mode === 'solar' || mode === 'transitioning') {
    const visualDays = playing ? dt * warp * 0.35 : 0;
    updateSolarSystem(solar, visualDays, playing);
  }

  if (mode === 'earth') {
    earthDetail.clouds.rotation.y += dt * 0.02;
    // Real-time layers: wall-clock only (warp decoupled)
    propAccum += dt;
    if (propAccum >= 0.12) {
      propAccum = 0;
      satLayer.requestPropagate(Date.now());
    }
    flightLayer.update(dt);
    updateIssLabel();
  } else {
    ui.setIssLabel(false);
  }

  starfield.rotation.y += dt * 0.003;
  renderer.render(scene, camera);
}

animate();

// Expose for debugging / Phase 3 checks
window.__LSS = {
  model: 'Cursor Grok 4.5',
  getMode: () => mode,
  getFps: () => fpsValue,
  satLayer,
  flightLayer,
  beginEarthTransition,
  beginSolarTransition,
};
