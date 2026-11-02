import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { batchStaticMeshes, materialBatchKey } from './staticBatcher';

function makeTree(x: number, color: number) {
  const g = new THREE.Group();
  g.position.set(x, 0, 0);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2, 8), new THREE.MeshStandardMaterial({ color: 0x5d4037 }));
  trunk.castShadow = true;
  const crown = new THREE.Mesh(new THREE.ConeGeometry(1, 2, 8), new THREE.MeshStandardMaterial({ color }));
  crown.position.y = 2;
  g.add(trunk, crown);
  return g;
}

test('identical materials produce the same batch key', () => {
  const a = new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.7 });
  const b = new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.7 });
  const c = new THREE.MeshStandardMaterial({ color: 0x388e3c, roughness: 0.2 });
  assert.equal(materialBatchKey(a), materialBatchKey(b));
  assert.notEqual(materialBatchKey(a), materialBatchKey(c));
});

test('textured materials are not batched', () => {
  const m = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
  assert.equal(materialBatchKey(m), null);
});

test('ten trees with two materials collapse into two meshes', () => {
  const root = new THREE.Group();
  for (let i = 0; i < 10; i++) root.add(makeTree(i * 5, 0x2e7d32));
  const result = batchStaticMeshes(root);
  assert.equal(result.meshesBefore, 20);
  assert.equal(result.meshesAfter, 2);
  const trunk = root.children.find((c) => (c as THREE.Mesh).castShadow) as THREE.Mesh;
  assert.ok(trunk, 'shadow flag is preserved');
});

test('world transforms are baked into merged geometry', () => {
  const root = new THREE.Group();
  root.add(makeTree(100, 0x2e7d32));
  batchStaticMeshes(root);
  const box = new THREE.Box3().setFromObject(root);
  assert.ok(box.min.x > 98 && box.max.x < 102, `bounds were ${box.min.x}..${box.max.x}`);
  assert.ok(box.max.y > 2.5, 'crown offset is kept');
});
