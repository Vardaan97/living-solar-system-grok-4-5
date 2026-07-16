import * as THREE from 'three';

export class Picker {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._down = null;
    this.onPick = null;

    // Larger threshold helps mobile tap accuracy among dense instances
    this.raycaster.params.Points = { threshold: 0.05 };
    this.raycaster.params.Line = { threshold: 0.05 };

    domElement.addEventListener('pointerdown', (e) => {
      this._down = { x: e.clientX, y: e.clientY, t: performance.now() };
    });
    domElement.addEventListener('pointerup', (e) => {
      if (!this._down) return;
      const dx = e.clientX - this._down.x;
      const dy = e.clientY - this._down.y;
      const dt = performance.now() - this._down.t;
      this._down = null;
      if (dt > 400 || dx * dx + dy * dy > 100) return; // drag, not tap
      this._pick(e.clientX, e.clientY);
    });
  }

  _pick(clientX, clientY) {
    const rect = this.dom.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (this.onPick) this.onPick(this.raycaster);
  }
}

/**
 * Intersect list preferring instanceId hits; returns first useful hit.
 */
export function firstHit(raycaster, objects) {
  if (!objects.length) return null;
  const hits = raycaster.intersectObjects(objects, false);
  return hits[0] || null;
}
