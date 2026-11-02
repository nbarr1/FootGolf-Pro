/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Builds a stable key for a material so that visually identical materials created
 * separately (for example, one per tree) can share a single merged draw call.
 * Returns null for materials that should not be merged (textured or unsupported).
 */
export function materialBatchKey(material: THREE.Material): string | null {
  if (!(material instanceof THREE.MeshStandardMaterial) && !(material instanceof THREE.MeshBasicMaterial)) {
    return null;
  }
  if ((material as THREE.MeshStandardMaterial).map) return null;

  const parts: (string | number | boolean)[] = [
    material.type,
    material.color.getHexString(),
    material.side,
    material.transparent,
    material.opacity,
    material.depthWrite,
  ];
  if (material instanceof THREE.MeshStandardMaterial) {
    parts.push(
      material.roughness,
      material.metalness,
      material.emissive.getHexString(),
      material.emissiveIntensity,
      material.flatShading
    );
  }
  return parts.join('|');
}

export interface BatchResult {
  meshesBefore: number;
  meshesAfter: number;
}

/**
 * Merges every untextured static mesh under `root` into one mesh per material key.
 * World transforms are baked into the merged geometry. Shadow flags are combined:
 * a merged mesh casts shadows if any source mesh did.
 *
 * The original meshes are removed and their geometries disposed. Materials that
 * become unused are disposed too.
 */
export function batchStaticMeshes(root: THREE.Object3D): BatchResult {
  root.updateMatrixWorld(true);
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();

  const buckets = new Map<
    string,
    { material: THREE.Material; geometries: THREE.BufferGeometry[]; castShadow: boolean; receiveShadow: boolean }
  >();
  const toRemove: THREE.Mesh[] = [];
  let meshesBefore = 0;

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    meshesBefore++;
    if (Array.isArray(mesh.material)) return;
    const key = materialBatchKey(mesh.material);
    if (!key) return;

    let geom = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    // Keep only attributes every primitive shares so mergeGeometries accepts them
    for (const name of Object.keys(geom.attributes)) {
      if (name !== 'position' && name !== 'normal') geom.deleteAttribute(name);
    }
    if (!geom.attributes.normal) geom.computeVertexNormals();
    geom.applyMatrix4(new THREE.Matrix4().multiplyMatrices(rootInverse, mesh.matrixWorld));
    geom.clearGroups();

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { material: mesh.material, geometries: [], castShadow: false, receiveShadow: false };
      buckets.set(key, bucket);
    }
    bucket.geometries.push(geom);
    bucket.castShadow ||= mesh.castShadow;
    bucket.receiveShadow ||= mesh.receiveShadow;
    toRemove.push(mesh);
  });

  const keptMaterials = new Set<THREE.Material>();
  for (const bucket of buckets.values()) keptMaterials.add(bucket.material);

  for (const mesh of toRemove) {
    mesh.parent?.remove(mesh);
    mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material;
    if (!keptMaterials.has(mat)) mat.dispose();
  }

  // Drop groups left empty by the removal
  const emptyGroups: THREE.Object3D[] = [];
  root.traverse((obj) => {
    if (obj !== root && !(obj as THREE.Mesh).isMesh && obj.children.length === 0) emptyGroups.push(obj);
  });
  for (const g of emptyGroups) g.parent?.remove(g);

  for (const bucket of buckets.values()) {
    const merged = mergeGeometries(bucket.geometries, false);
    for (const g of bucket.geometries) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.castShadow = bucket.castShadow;
    mesh.receiveShadow = bucket.receiveShadow;
    mesh.matrixAutoUpdate = false;
    mesh.name = 'batched-props';
    root.add(mesh);
  }

  let meshesAfter = 0;
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) meshesAfter++;
  });
  return { meshesBefore, meshesAfter };
}

/** Removes and disposes every child of `root`, including nested geometries and materials. */
export function disposeChildren(root: THREE.Object3D): void {
  const materials = new Set<THREE.Material>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => materials.add(m));
    }
  });
  materials.forEach((m) => m.dispose());
  while (root.children.length > 0) root.remove(root.children[0]);
}
