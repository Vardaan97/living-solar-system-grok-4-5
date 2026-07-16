import * as THREE from 'three';

export const EARTH_RADIUS_KM = 6371;
export const EARTH_RADIUS = 1; // scene units in Earth mode

/** Convert geodetic lat/lon/alt(km) to ECEF in Earth-local scene units (Y-up). */
export function latLonAltToVec3(latDeg, lonDeg, altKm, target = new THREE.Vector3()) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  const r = EARTH_RADIUS * (1 + altKm / EARTH_RADIUS_KM);
  const cosLat = Math.cos(lat);
  // Three.js Y-up: X = cos(lat)cos(lon), Z = -cos(lat)sin(lon), Y = sin(lat)
  // Standard ECEF: x east from Greenwich — map to Three: x=ECEF.x, y=ECEF.z, z=-ECEF.y
  const ecefX = r * cosLat * Math.cos(lon);
  const ecefY = r * cosLat * Math.sin(lon);
  const ecefZ = r * Math.sin(lat);
  return target.set(ecefX, ecefZ, -ecefY);
}

export function createEarthDetail() {
  const group = new THREE.Group();
  group.name = 'earthLocalGroup';
  group.visible = false;

  const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 48);
  const earthMat = new THREE.MeshStandardMaterial({
    color: 0x1a4d8c,
    roughness: 0.85,
    metalness: 0.05,
    emissive: 0x061525,
    emissiveIntensity: 0.35,
  });
  // Procedural continents via vertex colors on a cloned geometry
  paintContinents(earthGeo);
  const earth = new THREE.Mesh(earthGeo, earthMat);
  earth.name = 'EarthDetail';
  earth.castShadow = false;
  earth.receiveShadow = true;
  group.add(earth);

  const atmos = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 1.035, 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0x4db8ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  group.add(atmos);

  // Simple cloud band
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 1.01, 48, 32),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      roughness: 1,
      depthWrite: false,
    })
  );
  group.add(clouds);

  return { group, earth, atmos, clouds };
}

function paintContinents(geometry) {
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cLand = new THREE.Color(0x2f6b3a);
  const cOcean = new THREE.Color(0x1a4d8c);
  const cIce = new THREE.Color(0xddeeff);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const lat = Math.asin(v.y);
    const lon = Math.atan2(-v.z, v.x);
    let c = cOcean;
    // Cheap continent noise
    const n =
      Math.sin(lon * 3.1 + lat * 2.7) * Math.cos(lat * 4.2) +
      Math.sin(lon * 7.3 - lat * 5.1) * 0.35;
    if (Math.abs(lat) > 1.2) c = cIce;
    else if (n > 0.22) c = cLand;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // Material must use vertexColors — caller sets on mesh material
  geometry.userData.vertexColors = true;
}

export function applyEarthVertexColors(mesh) {
  if (mesh.geometry.userData.vertexColors) {
    mesh.material.vertexColors = true;
  }
}
