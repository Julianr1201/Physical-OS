'use client';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { figureKind, type FigureSample } from '@physical-os/presence';
import * as THREE from 'three';

const modelUrl = '/presence/female-adult-01.glb';

export function loadPresenceMesh(count: number): Promise<FigureSample> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader.loadAsync(modelUrl).then((gltf) => {
    const meshes = findSkins(gltf.scene);
    gltf.scene.updateMatrixWorld(true);
    for (const mesh of meshes) mesh.skeleton.update();
    return sampleSkinned(meshes, count);
  });
}

function findSkins(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const found: THREE.SkinnedMesh[] = [];
  root.traverse((object) => {
    if ((object as THREE.SkinnedMesh).isSkinnedMesh) found.push(object as THREE.SkinnedMesh);
  });
  if (found.length === 0) throw new Error('The presence mesh has no skin.');
  return found;
}

function sampleSkinned(meshes: THREE.SkinnedMesh[], count: number): FigureSample {
  const baked = meshes.map((mesh) => bakeMesh(mesh));
  let maxY = Number.NEGATIVE_INFINITY;
  for (const positions of baked) {
    for (let index = 1; index < positions.length; index += 3) {
      const y = positions[index] ?? 0;
      if (y > maxY) maxY = y;
    }
  }
  const cutoff = maxY - 0.78;
  const triangles: number[] = [];
  let totalArea = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  baked.forEach((positions, meshIndex) => {
    const mesh = meshes[meshIndex];
    if (!mesh) return;
    const index = mesh.geometry.index;
    const vertexCount = positions.length / 3;
    const triCount = index ? index.count / 3 : vertexCount / 3;
    for (let tri = 0; tri < triCount; tri += 1) {
      readTriangle(positions, index, tri, a, b, c);
      if ((a.y + b.y + c.y) / 3 < cutoff) continue;
      const area = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() * 0.5;
      if (area <= 0) continue;
      totalArea += area;
      triangles.push(totalArea, meshIndex, tri);
    }
  });
  if (triangles.length === 0) throw new Error('The presence mesh produced no surface.');
  const random = mulberry32(0x504f53);
  const points: Array<[number, number, number]> = [];
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minYv = Number.POSITIVE_INFINITY;
  let maxYv = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (let n = 0; n < count; n += 1) {
    const pick = random() * totalArea;
    let lo = 0;
    let hi = triangles.length / 3 - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((triangles[mid * 3] ?? 0) < pick) lo = mid + 1;
      else hi = mid;
    }
    const meshIndex = triangles[lo * 3 + 1] ?? 0;
    const tri = triangles[lo * 3 + 2] ?? 0;
    const positions = baked[meshIndex];
    const index = meshes[meshIndex]?.geometry.index ?? null;
    if (!positions) continue;
    readTriangle(positions, index, tri, a, b, c);
    const r1 = Math.sqrt(random());
    const r2 = random();
    const point: [number, number, number] = [
      a.x * (1 - r1) + b.x * r1 * (1 - r2) + c.x * r1 * r2,
      a.y * (1 - r1) + b.y * r1 * (1 - r2) + c.y * r1 * r2,
      a.z * (1 - r1) + b.z * r1 * (1 - r2) + c.z * r1 * r2,
    ];
    points.push(point);
    minX = Math.min(minX, point[0]);
    maxX = Math.max(maxX, point[0]);
    minYv = Math.min(minYv, point[1]);
    maxYv = Math.max(maxYv, point[1]);
    minZ = Math.min(minZ, point[2]);
    maxZ = Math.max(maxZ, point[2]);
  }
  const height = Math.max(0.001, maxYv - minYv);
  const scale = 0.95 / height;
  const midX = (minX + maxX) / 2;
  const midZ = (minZ + maxZ) / 2;
  const anchorY = maxYv - height * 0.22;
  const ring = Math.round(count * 0.04);
  const total = points.length + ring;
  const positions = new Float32Array(total * 3);
  const kind = new Float32Array(total);
  const side = new Float32Array(total);
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    if (!point) continue;
    positions[i * 3] = (point[0] - midX) * scale;
    positions[i * 3 + 1] = (point[1] - anchorY) * scale + 0.33;
    positions[i * 3 + 2] = (point[2] - midZ) * scale;
    kind[i] = figureKind.head;
  }
  for (let i = 0; i < ring; i += 1) {
    const cursor = points.length + i;
    const angle = (i / ring) * Math.PI * 2;
    positions[cursor * 3] = Math.cos(angle) * 0.36;
    positions[cursor * 3 + 1] = -0.12;
    positions[cursor * 3 + 2] = Math.sin(angle) * 0.16;
    kind[cursor] = figureKind.ring;
  }
  return { count: total, positions, kind, side };
}

function bakeMesh(mesh: THREE.SkinnedMesh): Float32Array {
  const source = mesh.geometry.attributes.position;
  if (!source) throw new Error('The presence mesh has no positions.');
  const baked = new Float32Array(source.count * 3);
  const vertex = new THREE.Vector3();
  for (let i = 0; i < source.count; i += 1) {
    vertex.fromBufferAttribute(source, i);
    mesh.applyBoneTransform(i, vertex);
    baked[i * 3] = vertex.x;
    baked[i * 3 + 1] = vertex.z;
    baked[i * 3 + 2] = vertex.y;
  }
  return baked;
}

function readTriangle(
  baked: Float32Array,
  index: THREE.BufferAttribute | null,
  tri: number,
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
): void {
  const ia = index ? index.getX(tri * 3) : tri * 3;
  const ib = index ? index.getX(tri * 3 + 1) : tri * 3 + 1;
  const ic = index ? index.getX(tri * 3 + 2) : tri * 3 + 2;
  read(baked, ia, a);
  read(baked, ib, b);
  read(baked, ic, c);
}

function read(baked: Float32Array, index: number, target: THREE.Vector3): void {
  target.set(baked[index * 3] ?? 0, baked[index * 3 + 1] ?? 0, baked[index * 3 + 2] ?? 0);
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
