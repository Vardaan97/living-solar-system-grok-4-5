const WARP_STEPS = [1, 10, 100, 1000, 5000, 10000, 50000];

export function bindUI(handlers) {
  const els = {
    banner: document.getElementById('data-banner'),
    statusPill: document.getElementById('status-pill'),
    fpsText: document.getElementById('fps-text'),
    modeText: document.getElementById('mode-text'),
    warp: document.getElementById('warp'),
    warpLabel: document.getElementById('warp-label'),
    warpHint: document.getElementById('warp-hint'),
    play: document.getElementById('btn-play'),
    earth: document.getElementById('btn-earth'),
    solar: document.getElementById('btn-solar'),
    satCount: document.getElementById('sat-count'),
    satSearch: document.getElementById('sat-search'),
    popup: document.getElementById('popup'),
    popupTitle: document.getElementById('popup-title'),
    popupBody: document.getElementById('popup-body'),
    popupClose: document.getElementById('popup-close'),
    issLabel: document.getElementById('iss-label'),
    layers: {
      starlink: document.getElementById('layer-starlink'),
      gps: document.getElementById('layer-gps'),
      oneweb: document.getElementById('layer-oneweb'),
      flights: document.getElementById('layer-flights'),
      orbits: document.getElementById('layer-orbits'),
      labels: document.getElementById('layer-labels'),
    },
  };

  els.earth.addEventListener('click', () => handlers.goEarth());
  els.solar.addEventListener('click', () => handlers.goSolar());
  els.play.addEventListener('click', () => handlers.togglePlay());
  els.warp.addEventListener('input', () => {
    const w = WARP_STEPS[Number(els.warp.value)] || 1;
    els.warpLabel.textContent = `${w.toLocaleString()}×`;
    handlers.setWarp(w);
  });
  els.satCount.addEventListener('change', () => handlers.setSatCount(els.satCount.value));
  els.satSearch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlers.searchSat(els.satSearch.value.trim());
  });
  els.popupClose.addEventListener('click', () => hidePopup(els));

  for (const [key, el] of Object.entries(els.layers)) {
    el.addEventListener('change', () => handlers.setLayer(key, el.checked));
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hidePopup(els);
  });

  return {
    els,
    showBanner(message, kind = 'warn') {
      els.banner.textContent = message;
      els.banner.classList.add('visible');
      els.statusPill.classList.toggle('warn', kind === 'warn');
      els.statusPill.classList.toggle('bad', kind === 'bad');
    },
    clearBanner() {
      els.banner.classList.remove('visible');
      els.statusPill.classList.remove('warn', 'bad');
    },
    setFps(fps) {
      els.fpsText.textContent = `${fps} FPS`;
    },
    setMode(mode) {
      els.modeText.textContent = mode;
    },
    setPlaying(playing) {
      els.play.textContent = playing ? 'Pause' : 'Play';
    },
    showPopup(title, rows) {
      els.popupTitle.textContent = title;
      els.popupBody.innerHTML = rows
        .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(String(v))}</dd>`)
        .join('');
      els.popup.classList.add('visible');
    },
    hidePopup() {
      hidePopup(els);
    },
    setIssLabel(visible, x, y) {
      const lab = els.issLabel;
      if (!visible) {
        lab.style.display = 'none';
        return;
      }
      lab.style.display = 'block';
      lab.style.left = `${x}px`;
      lab.style.top = `${y}px`;
    },
    getLayerState() {
      return {
        starlink: els.layers.starlink.checked,
        gps: els.layers.gps.checked,
        oneweb: els.layers.oneweb.checked,
        flights: els.layers.flights.checked,
        orbits: els.layers.orbits.checked,
        labels: els.layers.labels.checked,
      };
    },
  };
}

function hidePopup(els) {
  els.popup.classList.remove('visible');
}

function escapeHtml(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export { WARP_STEPS };
