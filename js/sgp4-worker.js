/* global importScripts, satellite */
importScripts('https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/dist/satellite.min.js');

let catalog = []; // { name, norad, group, satrec, line1, line2 }

function parseTleBlock(text, group) {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  const out = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (!lines[i].startsWith('1 ') || !lines[i + 1]?.startsWith('2 ')) continue;
    const line1 = lines[i];
    const line2 = lines[i + 1];
    let name = `SAT-${line1.substring(2, 7).trim()}`;
    if (i > 0 && !lines[i - 1].startsWith('1 ') && !lines[i - 1].startsWith('2 ')) {
      name = lines[i - 1];
    }
    try {
      const satrec = satellite.twoline2satrec(line1, line2);
      if (satrec.error) continue;
      const norad = Number(line1.substring(2, 7));
      out.push({ name, norad, group, satrec, line1, line2 });
    } catch {
      // skip bad record
    }
    i += 1;
  }
  return out;
}

function orbitalPeriodMin(satrec) {
  // mean motion rev/day
  const n = satrec.no; // rad/min in satellite.js
  if (!n) return null;
  return (2 * Math.PI) / n; // minutes
}

function inclinationDeg(satrec) {
  return (satrec.inclo * 180) / Math.PI;
}

self.onmessage = (ev) => {
  const msg = ev.data;
  if (msg.type === 'setCatalog') {
    catalog = [];
    for (const block of msg.blocks) {
      catalog.push(...parseTleBlock(block.text, block.group));
    }
    self.postMessage({
      type: 'catalogReady',
      count: catalog.length,
      meta: catalog.map((c) => ({
        name: c.name,
        norad: c.norad,
        group: c.group,
        periodMin: orbitalPeriodMin(c.satrec),
        inclination: inclinationDeg(c.satrec),
      })),
    });
    return;
  }

  if (msg.type === 'propagate') {
    const date = new Date(msg.timeMs);
    const gmst = satellite.gstime(date);
    const n = catalog.length;
    const positions = new Float32Array(n * 3);
    const extras = new Float32Array(n * 5); // lat, lon, altKm, velKmS, valid

    for (let i = 0; i < n; i++) {
      const c = catalog[i];
      try {
        const pv = satellite.propagate(c.satrec, date);
        if (!pv.position || !pv.velocity) {
          extras[i * 5 + 4] = 0;
          continue;
        }
        const geo = satellite.eciToGeodetic(pv.position, gmst);
        const lat = satellite.degreesLat(geo.latitude);
        const lon = satellite.degreesLong(geo.longitude);
        const altKm = geo.height;
        const velKmS = Math.sqrt(
          pv.velocity.x ** 2 + pv.velocity.y ** 2 + pv.velocity.z ** 2
        );
        // ECEF for rendering consistency with Earth layer (km → later normalized on main)
        const ecf = satellite.eciToEcf(pv.position, gmst);
        positions[i * 3] = ecf.x;
        positions[i * 3 + 1] = ecf.z;
        positions[i * 3 + 2] = -ecf.y;
        extras[i * 5] = lat;
        extras[i * 5 + 1] = lon;
        extras[i * 5 + 2] = altKm;
        extras[i * 5 + 3] = velKmS;
        extras[i * 5 + 4] = 1;
      } catch {
        extras[i * 5 + 4] = 0;
      }
    }

    self.postMessage(
      { type: 'positions', timeMs: msg.timeMs, positions, extras, count: n },
      [positions.buffer, extras.buffer]
    );
  }
};
