import * as THREE from 'three';

/** Stylized solar system — distances & sizes NOT to scale (labeled in UI). */
const AU = 80;

const PLANETS = [
  { name: 'Mercury', color: 0xb1b1b1, radius: 0.55, au: 0.39, periodDays: 87.97, tilt: 0.03, spin: 0.004 },
  { name: 'Venus', color: 0xe8cda0, radius: 0.9, au: 0.72, periodDays: 224.7, tilt: 177.4, spin: -0.002 },
  { name: 'Earth', color: 0x3a7bd5, radius: 1.0, au: 1.0, periodDays: 365.25, tilt: 23.4, spin: 0.02, isEarth: true },
  { name: 'Mars', color: 0xc1440e, radius: 0.7, au: 1.52, periodDays: 686.98, tilt: 25.2, spin: 0.018 },
  { name: 'Jupiter', color: 0xd9b38c, radius: 2.8, au: 5.2, periodDays: 4332.6, tilt: 3.1, spin: 0.04 },
  { name: 'Saturn', color: 0xe6d3a3, radius: 2.3, au: 9.5, periodDays: 10759, tilt: 26.7, spin: 0.038, rings: true },
  { name: 'Uranus', color: 0x7de3e0, radius: 1.5, au: 19.2, periodDays: 30687, tilt: 97.8, spin: 0.03 },
  { name: 'Neptune', color: 0x3f6cff, radius: 1.45, au: 30.1, periodDays: 60190, tilt: 28.3, spin: 0.032 },
];

export function createSolarSystem() {
  const root = new THREE.Group();
  root.name = 'solarSystemGroup';

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0xffcc66 })
  );
  sun.name = 'Sun';
  root.add(sun);

  const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.22, depthWrite: false })
  );
  root.add(sunGlow);

  const sunLight = new THREE.PointLight(0xfff2d0, 2.4, 0, 0.6);
  sun.add(sunLight);
  root.add(new THREE.AmbientLight(0x334466, 0.35));

  const planets = [];
  const orbitLines = new THREE.Group();
  orbitLines.name = 'orbitLines';
  root.add(orbitLines);

  for (const def of PLANETS) {
    const pivot = new THREE.Object3D();
    pivot.name = `${def.name}Pivot`;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(def.radius, 32, 24),
      new THREE.MeshStandardMaterial({
        color: def.color,
        roughness: 0.7,
        metalness: 0.05,
        emissive: def.isEarth ? 0x0a2038 : 0x000000,
        emissiveIntensity: def.isEarth ? 0.25 : 0,
      })
    );
    mesh.name = def.name;
    mesh.userData.planet = def.name;
    mesh.userData.isEarth = !!def.isEarth;
    mesh.rotation.z = THREE.MathUtils.degToRad(def.tilt) * 0.15;

    const dist = def.au * AU;
    mesh.position.x = dist;

    if (def.rings) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(def.radius * 1.4, def.radius * 2.3, 64),
        new THREE.MeshBasicMaterial({ color: 0xcbb896, side: THREE.DoubleSide, transparent: true, opacity: 0.65 })
      );
      ring.rotation.x = Math.PI / 2.3;
      mesh.add(ring);
    }

    pivot.add(mesh);
    root.add(pivot);

    const curve = new THREE.EllipseCurve(0, 0, dist, dist, 0, Math.PI * 2, false, 0);
    const pts = curve.getPoints(128).map((p) => new THREE.Vector3(p.x, 0, p.y));
    const orbit = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x5a6d8c, transparent: true, opacity: 0.45 })
    );
    orbitLines.add(orbit);

    // Mean anomaly phase offset for visual variety
    const phase = Math.random() * Math.PI * 2;

    planets.push({
      def,
      pivot,
      mesh,
      dist,
      phase,
      angle: phase,
    });
  }

  return {
    root,
    sun,
    planets,
    orbitLines,
    earthEntry: planets.find((p) => p.def.isEarth),
  };
}

export function updateSolarSystem(system, dtDays, playing) {
  if (!playing) return;
  for (const p of system.planets) {
    const omega = (Math.PI * 2) / p.def.periodDays; // rad per day
    p.angle += omega * dtDays;
    p.pivot.rotation.y = p.angle;
    p.mesh.rotation.y += p.def.spin * dtDays * 10;
  }
}

export function createStarfield(count = 2200) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 600 + Math.random() * 900;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xcfe2ff,
    size: 1.1,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.name = 'starfield';
  return points;
}

export { PLANETS, AU };
