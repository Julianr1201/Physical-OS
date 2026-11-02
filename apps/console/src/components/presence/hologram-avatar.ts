'use client';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {
  extentMatchesUp,
  femaleAdult01Axes,
  type ExpressionName,
  type PerformanceTier,
} from '@physical-os/presence';
import * as THREE from 'three';
import { headCenter } from './mesh-sample';

const modelUrl = '/presence/female-adult-01.glb';
const yawScratch = new THREE.Quaternion();
const pitchScratch = new THREE.Quaternion();

export interface MaterialFade {
  material: THREE.Material;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
}

export interface HologramModel {
  group: THREE.Group;
  materials: MaterialFade[];
  bones: FacialBones;
  loadMs: number;
  baseY: number;
}

interface BonePose {
  bone: THREE.Bone;
  rest: THREE.Quaternion;
  yaw: THREE.Vector3;
  pitch: THREE.Vector3;
}

interface FacialBones {
  head?: BonePose;
  neck?: BonePose;
  jaw?: BonePose;
  arm?: BonePose;
  eyes: BonePose[];
  lids: BonePose[];
  brows: BonePose[];
  corners: BonePose[];
}

export async function loadHologram(_tier: PerformanceTier): Promise<HologramModel> {
  const started = performance.now();
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(modelUrl);
  const meshes = findSkins(gltf.scene);
  gltf.scene.updateMatrixWorld(true);
  for (const mesh of meshes) mesh.skeleton.update();
  const measured = headCenter(meshes, femaleAdult01Axes.up);
  if (!extentMatchesUp(measured.min, measured.max, femaleAdult01Axes.up)) {
    throw new Error('The presence mesh is not standing on its declared axis.');
  }
  const group = new THREE.Group();
  group.add(gltf.scene);
  for (const mesh of meshes) mesh.frustumCulled = false;
  group.updateMatrixWorld(true);
  const bones = cacheBones(gltf.scene);
  return {
    group,
    materials: collectMaterials(meshes),
    bones,
    loadMs: Math.round(performance.now() - started),
    baseY: 0,
  };
}

export function poseHologram(
  model: HologramModel,
  input: {
    gazeX: number;
    gazeY: number;
    mouth: number;
    blink: number;
    brow: number;
    gesture: number;
    expression: ExpressionName;
    opacity: number;
    time: number;
    reducedMotion: boolean;
  },
): void {
  const sway = input.reducedMotion ? 0 : Math.sin(input.time * 0.31) * 0.03;
  const breath = input.reducedMotion ? 0 : Math.sin(input.time * 1.25) * 0.012;
  const smile = input.expression === 'pleased' ? 0.1 : input.expression === 'attentive' ? 0.04 : 0;
  applyBone(model.bones.head, input.gazeX * 0.12 + sway, input.gazeY * 0.07 + breath);
  applyBone(model.bones.neck, input.gazeX * 0.05 + sway * 0.4, breath * 0.6);
  applyBone(model.bones.jaw, 0, -input.mouth * 0.34);
  for (const eye of model.bones.eyes) applyBone(eye, input.gazeX * 0.22, input.gazeY * 0.16);
  for (const lid of model.bones.lids) applyBone(lid, 0, input.blink * 0.5);
  for (const brow of model.bones.brows) applyBone(brow, 0, input.brow * 0.12);
  model.bones.corners.forEach((corner, index) => applyBone(corner, (index === 0 ? 1 : -1) * smile, 0));
  model.group.position.y = model.baseY + breath;
  applyPresenceFade(model.materials, input.opacity);
}

export function applyPresenceFade(materials: MaterialFade[], factor: number): void {
  for (const entry of materials) {
    if (factor >= 0.85) {
      entry.material.opacity = entry.opacity;
      entry.material.transparent = entry.transparent;
      entry.material.depthWrite = entry.depthWrite;
      continue;
    }
    entry.material.opacity = entry.opacity * factor;
    entry.material.transparent = true;
    entry.material.depthWrite = factor > 0.6 && entry.depthWrite;
  }
}

export function disposeHologram(model: HologramModel): void {
  const disposed = new Set<THREE.Material>();
  model.group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) {
      if (disposed.has(material)) continue;
      disposed.add(material);
      disposeMaterial(material);
    }
  });
}

function cacheBones(root: THREE.Object3D): FacialBones {
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3(1, 0, 0);
  const pose = (name: string) => {
    const object = root.getObjectByName(name);
    if (!object || !(object as THREE.Bone).isBone) return undefined;
    const bone = object as THREE.Bone;
    bone.updateWorldMatrix(true, false);
    const inverse = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
    return {
      bone,
      rest: bone.quaternion.clone(),
      yaw: up.clone().applyQuaternion(inverse).normalize(),
      pitch: right.clone().applyQuaternion(inverse).normalize(),
    };
  };
  return {
    head: pose('Bip01_Head'),
    neck: pose('Bip01_Neck'),
    jaw: pose('Bip01_MJaw'),
    arm: pose('Bip01_R_UpperArm') ?? pose('Bip01_RUpperArm'),
    eyes: ['Bip01_REye', 'Bip01_LEye'].map(pose).filter((bone): bone is BonePose => Boolean(bone)),
    lids: ['Bip01_REyeBlinkTop', 'Bip01_LEyeBlinkTop'].map(pose).filter((bone): bone is BonePose => Boolean(bone)),
    brows: ['Bip01_RInnerEyebrow', 'Bip01_LInnerEyebrow', 'Bip01_MMiddleEyebrow'].map(pose).filter((bone): bone is BonePose => Boolean(bone)),
    corners: ['Bip01_RMouthCorner', 'Bip01_LMouthCorner'].map(pose).filter((bone): bone is BonePose => Boolean(bone)),
  };
}

function applyBone(pose: BonePose | undefined, yaw: number, pitch: number): void {
  if (!pose) return;
  yawScratch.setFromAxisAngle(pose.yaw, yaw);
  pitchScratch.setFromAxisAngle(pose.pitch, pitch);
  pose.bone.quaternion.copy(pose.rest).multiply(yawScratch).multiply(pitchScratch);
}

function findSkins(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const found: THREE.SkinnedMesh[] = [];
  root.traverse((object) => {
    if ((object as THREE.SkinnedMesh).isSkinnedMesh) found.push(object as THREE.SkinnedMesh);
  });
  if (found.length === 0) throw new Error('The presence mesh has no skin.');
  return found;
}

function collectMaterials(meshes: THREE.SkinnedMesh[]): MaterialFade[] {
  const seen = new Set<THREE.Material>();
  const materials: MaterialFade[] = [];
  for (const mesh of meshes) {
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) {
      if (seen.has(material)) continue;
      seen.add(material);
      materials.push({
        material,
        opacity: material.opacity,
        transparent: material.transparent,
        depthWrite: material.depthWrite,
      });
    }
  }
  return materials;
}

function disposeMaterial(material: THREE.Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) value.dispose();
  }
  material.dispose();
}
