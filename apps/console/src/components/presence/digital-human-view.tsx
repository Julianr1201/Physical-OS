'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import {
  advanceBlink,
  blendMorphs,
  clipIntent,
  createBlink,
  digitalHumanUrl,
  morphFrame,
  visualFor,
  type ExpressionName,
  type PerformanceTier,
  type PresenceState,
  type SpeechCue,
} from '@physical-os/presence';

const gazeBones = ['Head', 'Neck', 'LeftEye', 'RightEye'] as const;

export function DigitalHuman({
  state,
  expression,
  cue,
  gestureMouth,
  tier,
  gaze,
  reducedMotion,
  onFailed,
  onFps,
}: {
  state: PresenceState;
  expression: ExpressionName;
  cue: SpeechCue | null;
  gestureMouth: number | null;
  tier: PerformanceTier;
  gaze: { x: number; y: number } | null;
  reducedMotion: boolean;
  onFailed: () => void;
  onFps: (fps: number) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const mixer = useRef<THREE.AnimationMixer | null>(null);
  const actions = useRef<Record<string, THREE.AnimationAction>>({});
  const currentClip = useRef<string | null>(null);
  const playedOnce = useRef<string | null>(null);
  const weights = useRef<Record<string, number>>({});
  const blink = useRef(createBlink());
  const bones = useRef<Partial<Record<(typeof gazeBones)[number], THREE.Bone>>>({});
  const rest = useRef<Partial<Record<(typeof gazeBones)[number], THREE.Quaternion>>>({});
  const ready = useRef(false);
  const [shown, setShown] = useState(false);
  const frames = useRef(0);
  const fpsWindow = useRef(0);
  const failed = useRef(onFailed);
  const props = useRef({ state, expression, cue, gestureMouth, gaze, reducedMotion, tier });
  failed.current = onFailed;
  props.current = { state, expression, cue, gestureMouth, gaze, reducedMotion, tier };

  useEffect(() => {
    const loader = new GLTFLoader();
    let disposed = false;
    let localMixer: THREE.AnimationMixer | null = null;
    const root = new THREE.Group();
    loader.load(
      digitalHumanUrl,
      (gltf) => {
        if (disposed || !group.current) {
          disposeObject(gltf.scene);
          return;
        }
        gltf.scene.traverse((node) => {
          const mesh = node as THREE.Mesh;
          if (mesh.isMesh) mesh.frustumCulled = false;
          const bone = node as THREE.Bone;
          if (bone.isBone && gazeBones.includes(bone.name as (typeof gazeBones)[number])) {
            bones.current[bone.name as (typeof gazeBones)[number]] = bone;
          }
        });
        root.add(gltf.scene);
        group.current.add(root);
        localMixer = new THREE.AnimationMixer(gltf.scene);
        mixer.current = localMixer;
        for (const clip of gltf.animations) actions.current[clip.name] = localMixer.clipAction(clip);
        localMixer.addEventListener('finished', (event) => {
          const action = event.action;
          playedOnce.current = action.getClip().name;
          const idle = actions.current.Idle;
          action.fadeOut(0.25);
          if (idle) {
            idle.reset().fadeIn(0.25).play();
            currentClip.current = 'Idle';
          }
        });
        const idle = actions.current.Idle;
        if (idle) {
          idle.play();
          currentClip.current = 'Idle';
          localMixer.update(1 / 30);
        }
        for (const name of gazeBones) {
          const bone = bones.current[name];
          if (bone) rest.current[name] = bone.quaternion.clone();
        }
        ready.current = true;
        setShown(true);
      },
      undefined,
      () => {
        if (!disposed) failed.current();
      },
    );
    return () => {
      disposed = true;
      ready.current = false;
      localMixer?.stopAllAction();
      mixer.current = null;
      actions.current = {};
      disposeObject(root);
    };
  }, []);

  useFrame((clock, dt) => {
    const step = Math.min(dt, 0.05);
    frames.current += 1;
    fpsWindow.current += step;
    if (fpsWindow.current >= 0.5) {
      onFps(Math.round(frames.current / fpsWindow.current));
      frames.current = 0;
      fpsWindow.current = 0;
    }
    if (!ready.current || !mixer.current || !group.current) return;
    const live = props.current;
    const pose = visualFor(live.state, live.expression, clock.clock.elapsedTime, live.state === 'AWAKENING' ? 1 : 0);
    blink.current = advanceBlink(blink.current, clock.clock.elapsedTime, live.reducedMotion ? 0 : step, pose.blinkBias > 0.9);
    const intent = clipIntent(live.state, live.expression);
    if (playedOnce.current && playedOnce.current !== intent.clip) playedOnce.current = null;
    const holdIdle = !intent.loop && playedOnce.current === intent.clip;
    const nextName = holdIdle ? 'Idle' : intent.clip;
    const action = actions.current[nextName] ?? actions.current.Idle;
    if (action && currentClip.current !== action.getClip().name) {
      const previous = currentClip.current ? actions.current[currentClip.current] : null;
      const looping = nextName === 'Idle' || (intent.loop && !holdIdle);
      action.reset();
      action.setLoop(looping ? THREE.LoopRepeat : THREE.LoopOnce, looping ? Infinity : 1);
      action.clampWhenFinished = !looping;
      action.fadeIn(0.28).play();
      previous?.fadeOut(0.28);
      currentClip.current = action.getClip().name;
    }
    mixer.current.update(live.reducedMotion ? 0 : step);
    const frame = morphFrame({
      expression: live.expression,
      blink: blink.current.closed,
      cue: live.cue,
      marks: null,
      timeMs: 0,
      gestureMouth: live.gestureMouth,
    });
    weights.current = blendMorphs(weights.current, frame.weights, live.reducedMotion ? 0.05 : step);
    applyMorphs(group.current, weights.current);
    const lookX = live.gaze?.x ?? pose.gazeX;
    const lookY = live.gaze?.y ?? pose.gazeY;
    aim(bones.current.Head, rest.current.Head, lookX, lookY, 0.22, 0.12);
    aim(bones.current.Neck, rest.current.Neck, lookX, lookY, 0.08, 0.04);
    if (live.tier !== 'low') {
      aim(bones.current.LeftEye, rest.current.LeftEye, lookX, lookY, 0.35, 0.2);
      aim(bones.current.RightEye, rest.current.RightEye, lookX, lookY, 0.35, 0.2);
    }
  });

  return <group ref={group} visible={shown} />;
}

function aim(
  bone: THREE.Bone | undefined,
  base: THREE.Quaternion | undefined,
  x: number,
  y: number,
  yaw: number,
  pitch: number,
): void {
  if (!bone || !base) return;
  bone.quaternion.copy(base);
  bone.rotateY(x * yaw);
  bone.rotateX(y * pitch);
}

function applyMorphs(root: THREE.Object3D, weights: Record<string, number>): void {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
    for (const [name, value] of Object.entries(weights)) {
      const index = mesh.morphTargetDictionary[name];
      if (index !== undefined && mesh.morphTargetInfluences[index] !== undefined) mesh.morphTargetInfluences[index] = value;
    }
  });
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}
