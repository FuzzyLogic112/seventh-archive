/* Shared physical layout for character movement, proximity and save validation. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ArchiveNavigation = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const RADIUS = 0.28;
  const BOUNDS = { x: 6.7, z: 5.15 };
  const SPAWN = { x: 0, z: 3.0 };
  const COLLIDERS = [
    { x: 0, z: 0, w: 3.25, d: 1.65 },
    { x: 0, z: -1.65, w: 0.75, d: 0.75 },
    { x: 6.05, z: -2.1, w: 1.05, d: 4.4 },
    { x: -6.03, z: -3.0, w: 1.25, d: 1.5 },
    { x: -6.13, z: 1.0, w: 0.95, d: 2.8 },
    { x: 4.7, z: 3.6, w: 2.1, d: 1.05 },
    { x: -4.7, z: 3.65, w: 1.45, d: 1.2 }
  ];
  const TARGETS = [
    { id: 'clock', label: '旧挂钟', x: -2.2, z: -4.3, range: 1.35, marker: [-2.2, 2.8, -5.22] },
    { id: 'desk', label: '书桌抽屉', x: 0, z: 1.5, range: 1.35, marker: [0, 1.35, 0.83], flag: 'deskOpen' },
    { id: 'books', label: '档案书柜', x: 4.65, z: -2.1, range: 1.4, marker: [5.45, 2.3, -2.1], flag: 'cabinetOpen' },
    { id: 'painting', label: '褪色星图', x: -4.85, z: 1.0, range: 1.4, marker: [-6.52, 2.7, 1.0], flag: 'paintingRevealed' },
    { id: 'safe', label: '旧保险柜', x: -4.65, z: -3.0, range: 1.35, marker: [-5.3, 1.45, -3.0], flag: 'safeOpen' },
    { id: 'panel', label: '配电箱', x: 3.1, z: -4.2, range: 1.4, marker: [3.1, 2.0, -5.18], flag: 'powerOn' },
    { id: 'door', label: '出口密码锁', x: 0.4, z: -4.25, range: 1.3, marker: [1.06, 1.65, -5.12], flag: 'escaped' }
  ];
  function validPosition(p) {
    return p && Number.isFinite(p.x) && Number.isFinite(p.z) &&
      Math.abs(p.x) <= BOUNDS.x - RADIUS && Math.abs(p.z) <= BOUNDS.z - RADIUS &&
      !COLLIDERS.some(b => Math.abs(p.x - b.x) < b.w / 2 + RADIUS && Math.abs(p.z - b.z) < b.d / 2 + RADIUS);
  }
  function restorePosition(raw) { return validPosition(raw) ? { x: raw.x, z: raw.z } : { ...SPAWN }; }
  function move(position, dx, dz) {
    const p = restorePosition(position);
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) return p;
    const count = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
    for (let i = 0; i < Math.min(count, 1000); i++) {
      const nextX = { x: p.x + dx / count, z: p.z };
      if (validPosition(nextX)) p.x = nextX.x;
      const nextZ = { x: p.x, z: p.z + dz / count };
      if (validPosition(nextZ)) p.z = nextZ.z;
    }
    return p;
  }
  function direction(x, z, yaw = 0) {
    const length = Math.max(1, Math.hypot(x, z));
    return { x: (x * Math.cos(yaw) + z * Math.sin(yaw)) / length, z: (-x * Math.sin(yaw) + z * Math.cos(yaw)) / length };
  }
  function nearby(position) {
    return TARGETS.map(t => ({ ...t, distance: Math.hypot(position.x - t.x, position.z - t.z) }))
      .filter(t => t.distance <= t.range).sort((a, b) => a.distance - b.distance);
  }
  return { RADIUS, BOUNDS, SPAWN, COLLIDERS, TARGETS, validPosition, restorePosition, move, direction, nearby };
});
