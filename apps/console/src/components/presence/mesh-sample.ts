'use client';

import { figureKind, type FigureSample, type Vec3 } from '@physical-os/presence';
import * as THREE from 'three';

export function sampleSkinnedSurface(meshes: THREE.SkinnedMesh[], count: number, up: Vec3): FigureSample {
  if (count <= 0) return emptySample();
  const baked = meshes.map((mesh) => bakeMesh(mesh));
  let maxAlong = Number.NEGATIVE_INFINITY;
  for (const positions of baked) {
    for (let index = 0; index < positions.length; index += 3) {
      const along = alongOf(positions, index, up);
      if (along > maxAlong) maxAlong = along;
    }
  }
  const cutoff = maxAlong - 0.8;
  const triangles: number[] = [];
  let totalArea = 0;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const normal = new THREE.Vector3();
  baked.forEach((positions, meshIndex) => {
    const mesh = meshes[meshIndex];
    if (!mesh) return;
    const index = mesh.geometry.index;
    const triCount = index ? index.count / 3 : positions.length / 9;
    for (let tri = 0; tri < triCount; tri += 1) {
      readTriangle(positions, index, tri, a, b, c);
      const centroid = alongOfVector(a, up) + alongOfVector(b, up) + alongOfVector(c, up);
      if (centroid / 3 < cutoff) continue;
      const area = ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() * 0.5;
      if (area <= 0) continue;
      totalArea += area;
      triangles.push(totalArea, meshIndex, tri);
    }
  });
  if (triangles.length === 0) return emptySample();
  const random = mulberry32(0x504f53);
  const positions = new Float32Array(count * 3);
  const kind = new Float32Array(count);
  const side = new Float32Array(count);
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
    const source = baked[meshIndex];
    const index = meshes[meshIndex]?.geometry.index ?? null;
    if (!source) continue;
    readTriangle(source, index, tri, a, b, c);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    normal.crossVectors(ab, ac).normalize();
    const r1 = Math.sqrt(random());
    const r2 = random();
    const x = a.x * (1 - r1) + b.x * r1 * (1 - r2) + c.x * r1 * r2;
    const y = a.y * (1 - r1) + b.y * r1 * (1 - r2) + c.y * r1 * r2;
    const z = a.z * (1 - r1) + b.z * r1 * (1 - r2) + c.z * r1 * r2;
    positions[n * 3] = x + normal.x * 0.006;
    positions[n * 3 + 1] = y + normal.y * 0.006;
    positions[n * 3 + 2] = z + normal.z * 0.006;
    kind[n] = figureKind.head;
  }
  return { count, positions, kind, side };
}

export function headCenter(meshes: THREE.SkinnedMesh[], up: Vec3): { center: Vec3; min: Vec3; max: Vec3 } {
  const min: Vec3 = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max: Vec3 = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  const points: number[] = [];
  const vertex = new THREE.Vector3();
  for (const mesh of meshes) {
    const position = mesh.geometry.attributes.position;
    if (!position) continue;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      mesh.applyBoneTransform(index, vertex);
      points.push(vertex.x, vertex.y, vertex.z);
      min[0] = Math.min(min[0], vertex.x);
      min[1] = Math.min(min[1], vertex.y);
      min[2] = Math.min(min[2], vertex.z);
      max[0] = Math.max(max[0], vertex.x);
      max[1] = Math.max(max[1], vertex.y);
      max[2] = Math.max(max[2], vertex.z);
    }
  }
  let maxAlong = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < points.length; index += 3) maxAlong = Math.max(maxAlong, alongOf(points, index, up));
  let count = 0;
  const center: Vec3 = [0, 0, 0];
  for (let index = 0; index < points.length; index += 3) {
    const along = alongOf(points, index, up);
    if (along < maxAlong - 0.2 || along > maxAlong - 0.07) continue;
    center[0] += points[index] ?? 0;
    center[1] += points[index + 1] ?? 0;
    center[2] += points[index + 2] ?? 0;
    count += 1;
  }
  if (count === 0) return { center: [0, 0, 0], min, max };
  return { center: [center[0] / count, center[1] / count, center[2] / count], min, max };
}

export function ambientMist(): FigureSample {
  const mist = 140;
  const ring = 72;
  const total = mist + ring;
  const positions = new Float32Array(total * 3);
  const kind = new Float32Array(total);
  const side = new Float32Array(total);
  const random = mulberry32(0xA11CE);
  for (let index = 0; index < mist; index += 1) {
    const angle = random() * Math.PI * 2;
    const radius = 0.22 + random() * 0.38;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = 0.08 + random() * 0.52;
    positions[index * 3 + 2] = (random() - 0.5) * 0.28;
    kind[index] = figureKind.head;
  }
  for (let index = 0; index < ring; index += 1) {
    const cursor = mist + index;
    const angle = (index / ring) * Math.PI * 2;
    positions[cursor * 3] = Math.cos(angle) * 0.42;
    positions[cursor * 3 + 1] = -0.16;
    positions[cursor * 3 + 2] = Math.sin(angle) * 0.16;
    kind[cursor] = figureKind.ring;
  }
  return { count: total, positions, kind, side };
}

function bakeMesh(mesh: THREE.SkinnedMesh): Float32Array {
  const source = mesh.geometry.attributes.position;
  if (!source) return new Float32Array();
  const baked = new Float32Array(source.count * 3);
  const vertex = new THREE.Vector3();
  for (let index = 0; index < source.count; index += 1) {
    vertex.fromBufferAttribute(source, index);
    mesh.applyBoneTransform(index, vertex);
    baked[index * 3] = vertex.x;
    baked[index * 3 + 1] = vertex.y;
    baked[index * 3 + 2] = vertex.z;
  }
  return baked;
}

function alongOf(values: ArrayLike<number>, index: number, up: Vec3): number {
  return (values[index] ?? 0) * up[0] + (values[index + 1] ?? 0) * up[1] + (values[index + 2] ?? 0) * up[2];
}

function alongOfVector(point: THREE.Vector3, up: Vec3): number {
  return point.x * up[0] + point.y * up[1] + point.z * up[2];
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
  a.set(baked[ia * 3] ?? 0, baked[ia * 3 + 1] ?? 0, baked[ia * 3 + 2] ?? 0);
  b.set(baked[ib * 3] ?? 0, baked[ib * 3 + 1] ?? 0, baked[ib * 3 + 2] ?? 0);
  c.set(baked[ic * 3] ?? 0, baked[ic * 3 + 1] ?? 0, baked[ic * 3 + 2] ?? 0);
}

function emptySample(): FigureSample {
  return { count: 0, positions: new Float32Array(), kind: new Float32Array(), side: new Float32Array() };
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
