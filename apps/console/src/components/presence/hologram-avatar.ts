'use client';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {
  extentMatchesUp,
  femaleAdult01Axes,
  frameAvatar,
  shellBudget,
  type ExpressionName,
  type PerformanceTier,
} from '@physical-os/presence';
import * as THREE from 'three';
import { ambientMist, headCenter, sampleSkinnedSurface } from './mesh-sample';

const modelUrl = '/presence/female-adult-01.glb';
const yawScratch = new THREE.Quaternion();
const pitchScratch = new THREE.Quaternion();

export interface HologramModel {
  group: THREE.Group;
  shell: THREE.Mesh;
  ambient: ReturnType<typeof ambientMist>;
  hologram: THREE.MeshBasicMaterial;
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

export async function loadHologram(tier: PerformanceTier): Promise<HologramModel> {
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
  const frame = frameAvatar(femaleAdult01Axes, measured.center);
  const group = new THREE.Group();
  group.add(gltf.scene);
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(frame.right[0], frame.up[0], frame.face[0]),
    new THREE.Vector3(frame.right[1], frame.up[1], frame.face[1]),
    new THREE.Vector3(frame.right[2], frame.up[2], frame.face[2]),
  );
  group.quaternion.setFromRotationMatrix(basis);
  group.position.set(frame.position[0], frame.position[1], frame.position[2]);
  const hologram = createHologramMaterial(tier);
  for (const mesh of meshes) {
    replaceMaterial(mesh, hologram);
    mesh.frustumCulled = false;
  }
  const shellSample = sampleSkinnedSurface(meshes, shellBudget(tier), femaleAdult01Axes.up);
  const shell = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
  shell.visible = false;
  shell.name = 'presence-shell';
  if (shellSample.count > 0) {
    shell.geometry.dispose();
    shell.geometry = createShellGeometry(shellSample.positions, shellSample.kind, shellSample.side);
    shell.visible = true;
    shell.frustumCulled = false;
    shell.renderOrder = 2;
    group.add(shell);
  }
  group.updateMatrixWorld(true);
  const bones = cacheBones(gltf.scene);
  return {
    group,
    shell,
    ambient: ambientMist(),
    hologram,
    bones,
    loadMs: Math.round(performance.now() - started),
    baseY: frame.position[1],
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
  model.hologram.opacity = (tierOpacity(model.hologram) ?? 0.78) * input.opacity;
}

export function disposeHologram(model: HologramModel): void {
  model.hologram.dispose();
  model.shell.geometry.dispose();
  model.group.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || mesh === model.shell) return;
    mesh.geometry?.dispose();
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

function replaceMaterial(mesh: THREE.SkinnedMesh, material: THREE.Material): void {
  const previous = mesh.material;
  mesh.material = material;
  const list = Array.isArray(previous) ? previous : [previous];
  for (const item of list) item.dispose();
}

function createShellGeometry(positions: Float32Array, kind: Float32Array, side: Float32Array): THREE.InstancedBufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.setAttribute('instanceOffset', new THREE.InstancedBufferAttribute(positions, 3));
  geometry.setAttribute('aKind', new THREE.InstancedBufferAttribute(kind, 1));
  geometry.setAttribute('aSide', new THREE.InstancedBufferAttribute(side, 1));
  geometry.instanceCount = positions.length / 3;
  return geometry;
}

function createHologramMaterial(tier: PerformanceTier): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color: '#B5D7D2',
    transparent: true,
    opacity: tier === 'low' ? 0.94 : 0.8,
    side: THREE.DoubleSide,
  });
  material.userData.baseOpacity = material.opacity;
  return material;
}

function tierOpacity(material: THREE.MeshBasicMaterial): number {
  const base = material.userData.baseOpacity;
  return typeof base === 'number' ? base : material.opacity;
}
