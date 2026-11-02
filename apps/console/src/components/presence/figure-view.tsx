'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  advanceBlink,
  createBlink,
  figureKind,
  sampleFigure,
  sliceFigure,
  visualFor,
  type ExpressionName,
  type FigureSample,
  type PerformanceTier,
  type PresenceState,
} from '@physical-os/presence';
import * as THREE from 'three';

const vertexShader = /* glsl */ `
attribute vec3 instanceOffset;
attribute float aKind;
attribute float aSide;
uniform float uTime;
uniform float uMouth;
uniform float uBlink;
uniform vec2 uGaze;
uniform float uSpread;
uniform float uGesture;
uniform float uEnergy;
uniform float uBrow;
uniform float uSize;
varying vec2 vUv;
varying float vKind;
varying float vShade;

void main() {
  vUv = uv;
  vKind = aKind;
  vec3 p = instanceOffset;
  vec3 center = vec3(0.0, -0.15, 0.0);
  p += (p - center) * (uSpread - 1.0);
  vec3 normal = normalize(instanceOffset - vec3(0.0, 0.02, 0.0));
  float key = clamp(dot(normal, normalize(vec3(-0.3, 0.55, 0.85))), 0.0, 1.0);
  float fill = clamp(dot(normal, normalize(vec3(0.45, -0.15, 0.4))), 0.0, 1.0);
  vShade = normal.z < 0.0 ? 0.48 + fill * 0.15 : 0.62 + key * 0.38 + fill * 0.08;

  if (aKind < 0.5) {
    float brow = smoothstep(0.52, 0.56, instanceOffset.y) * (1.0 - smoothstep(0.58, 0.64, instanceOffset.y));
    brow *= 1.0 - min(1.0, abs(instanceOffset.x) * 8.0);
    p.y += brow * uBrow * 0.02;
  }
  if (aKind > 0.5 && aKind < 1.5) {
    p.x += uGaze.x * 0.012;
    p.y += uGaze.y * 0.008;
    vShade = 1.0;
  }
  if (aKind > 1.5 && aKind < 2.5) p.y -= uBlink * 0.018;
  if (aKind > 2.5 && aKind < 3.5) p.y += aSide * uMouth * 0.02;
  if ((aKind > 4.5 && aKind < 5.5 && aSide > 0.0) || (aKind > 6.5 && aKind < 7.5 && aSide > 0.0)) {
    vec3 pivot = vec3(-0.32, 0.16, 0.08);
    vec3 q = p - pivot;
    float ang = uGesture * 0.18;
    float c = cos(ang);
    float s = sin(ang);
    p.x = q.x + pivot.x;
    p.y = q.y * c - q.z * s + pivot.y;
    p.z = q.y * s + q.z * c + pivot.z;
  }
  p += sin(uTime * 0.67 + instanceOffset.y * 7.0 + instanceOffset.x * 5.0) * 0.0032 * uEnergy;

  vec4 view = modelViewMatrix * vec4(p, 1.0);
  view.x += position.x * uSize;
  view.y += position.y * uSize;
  gl_Position = projectionMatrix * view;
}
`;

const fragmentShader = /* glsl */ `
varying vec2 vUv;
varying float vKind;
varying float vShade;
uniform float uOpacity;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uDepth;
uniform vec3 uWarm;

void main() {
  vec2 centered = vUv - vec2(0.5);
  float dist = length(centered);
  if (dist > 0.5) discard;
  float alpha = smoothstep(0.5, 0.12, dist) * uOpacity;
  vec3 color = mix(uDepth, uPrimary, clamp(vShade, 0.0, 1.0));
  if (vKind > 0.5 && vKind < 1.5) color = mix(uDepth, uSecondary, 0.55);
  else if (vKind > 2.5 && vKind < 3.5) color = mix(uSecondary, uWarm, 0.28);
  else if (vKind > 7.5) color = mix(uPrimary, uSecondary, 0.45);
  gl_FragColor = vec4(color * (0.75 + vShade * 0.25), alpha);
}
`;

export function PresenceFigure({
  state,
  expression,
  mouth,
  tier,
  gaze,
  reducedMotion,
  onFps,
}: {
  state: PresenceState;
  expression: ExpressionName;
  mouth: number;
  tier: PerformanceTier;
  gaze: { x: number; y: number } | null;
  reducedMotion: boolean;
  onFps: (fps: number) => void;
}) {
  const head = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const blink = useRef(createBlink());
  const awaken = useRef(state === 'AWAKENING' ? 0 : 1);
  const frames = useRef(0);
  const started = useRef<number | null>(null);
  const reported = useRef(false);
  const bodyEnabled = tier !== 'low';
  const sampled = useMemo(() => sampleFigure(tier === 'high' ? 8000 : tier === 'medium' ? 3600 : 1400, { body: bodyEnabled }), [tier, bodyEnabled]);
  const headSample = useMemo(
    () => sliceFigure(sampled, (kind) => kind < figureKind.torso || kind === figureKind.hair),
    [sampled],
  );
  const bodySample = useMemo(
    () => sliceFigure(sampled, (kind) => kind === figureKind.torso || kind === figureKind.arm || kind === figureKind.hand),
    [sampled],
  );
  const ringSample = useMemo(() => sliceFigure(sampled, (kind) => kind === figureKind.ring), [sampled]);
  const material = useMemo(() => createMaterial(tier), [tier]);
  const uniforms = material.uniforms as {
    uTime: { value: number };
    uMouth: { value: number };
    uBlink: { value: number };
    uGaze: { value: THREE.Vector2 };
    uSpread: { value: number };
    uGesture: { value: number };
    uEnergy: { value: number };
    uBrow: { value: number };
    uOpacity: { value: number };
  };

  useEffect(() => () => material.dispose(), [material]);

  useFrame((clock, dt) => {
    if (state === 'AWAKENING') awaken.current = Math.min(1, awaken.current + dt * 0.7);
    else awaken.current = state === 'DORMANT' ? 0 : 1;
    const pose = visualFor(state, expression, clock.clock.elapsedTime, awaken.current);
    blink.current = advanceBlink(blink.current, clock.clock.elapsedTime, dt, pose.blinkBias > 0.9);
    const gazeX = gaze ? pose.gazeX * 0.35 + gaze.x : pose.gazeX;
    const gazeY = gaze ? pose.gazeY * 0.35 + gaze.y : pose.gazeY;
    const energy = reducedMotion ? 0 : pose.energy;
    uniforms.uTime.value = clock.clock.elapsedTime;
    uniforms.uMouth.value = Math.max(pose.mouthBias, mouth);
    uniforms.uBlink.value = Math.max(pose.blinkBias, blink.current.closed);
    uniforms.uGaze.value.set(gazeX, gazeY);
    uniforms.uSpread.value = pose.spread;
    uniforms.uGesture.value = pose.gesture;
    uniforms.uEnergy.value = energy;
    uniforms.uBrow.value = pose.brow;
    uniforms.uOpacity.value = pose.opacity;
    const sway = reducedMotion ? 0.08 : 1;
    if (head.current) {
      head.current.rotation.y = (Math.sin(clock.clock.elapsedTime * 0.31) * 0.08 + Math.sin(clock.clock.elapsedTime * 0.17) * 0.035 + gazeX * 0.18) * sway;
      head.current.rotation.x = (Math.sin(clock.clock.elapsedTime * 0.23) * 0.045 + gazeY * 0.12) * sway;
    }
    if (body.current) {
      body.current.rotation.y = (Math.sin(clock.clock.elapsedTime * 0.27) * 0.03 + gazeX * 0.05) * sway;
    }
    if (!reported.current) {
      const origin = started.current ?? clock.clock.elapsedTime;
      started.current = origin;
      frames.current += 1;
      if (frames.current >= 90) {
        reported.current = true;
        const elapsed = clock.clock.elapsedTime - origin;
        if (elapsed > 0) onFps(Math.round(frames.current / elapsed));
      }
    }
  });

  return (
    <group position={[0, 0.08, 0]}>
      <group ref={head}>
        <Cloud sample={headSample} material={material} />
      </group>
      {bodySample.count > 0 ? (
        <group ref={body}>
          <Cloud sample={bodySample} material={material} />
        </group>
      ) : null}
      {ringSample.count > 0 ? <Cloud sample={ringSample} material={material} /> : null}
    </group>
  );
}

function Cloud({ sample, material }: { sample: FigureSample; material: THREE.ShaderMaterial }) {
  const geometry = useMemo(() => createGeometry(sample), [sample]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

function createGeometry(sample: FigureSample): THREE.InstancedBufferGeometry {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.setAttribute('instanceOffset', new THREE.InstancedBufferAttribute(sample.positions, 3));
  geometry.setAttribute('aKind', new THREE.InstancedBufferAttribute(sample.kind, 1));
  geometry.setAttribute('aSide', new THREE.InstancedBufferAttribute(sample.side, 1));
  geometry.instanceCount = sample.count;
  return geometry;
}

function createMaterial(tier: PerformanceTier): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMouth: { value: 0 },
      uBlink: { value: 0 },
      uGaze: { value: new THREE.Vector2() },
      uSpread: { value: 1.6 },
      uGesture: { value: 0 },
      uEnergy: { value: 0.4 },
      uBrow: { value: 0 },
      uOpacity: { value: 0.4 },
      uSize: { value: tier === 'high' ? 0.01 : tier === 'medium' ? 0.014 : 0.022 },
      uPrimary: { value: new THREE.Color('#B5D7D2') },
      uSecondary: { value: new THREE.Color('#DCEAF0') },
      uDepth: { value: new THREE.Color('#5E859A') },
      uWarm: { value: new THREE.Color('#E5C89D') },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
}
