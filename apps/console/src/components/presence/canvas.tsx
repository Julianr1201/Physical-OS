'use client';

import { Canvas } from '@react-three/fiber';
import type { ExpressionName, PerformanceTier, PresenceState } from '@physical-os/presence';
import { PresenceFigure } from './figure-view';

export function PresenceCanvas({
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
  return (
    <Canvas
      camera={{ position: [0, 0.42, 1.7], fov: 28 }}
      dpr={tier === 'low' ? 1 : tier === 'medium' ? 1.25 : [1, 1.5]}
      gl={{ alpha: false, antialias: tier === 'high', powerPreference: 'high-performance' }}
      onCreated={({ camera }) => camera.lookAt(0, 0.38, 0)}
    >
      <color attach="background" args={['#101419']} />
        <ambientLight intensity={0.55} color="#DCEAF0" />
        <directionalLight position={[-0.6, 1.4, 1.6]} intensity={1.45} color="#F7FBFA" />
        <directionalLight position={[0.8, 0.3, 1]} intensity={0.35} color="#5E859A" />
        <PresenceFigure
        state={state}
        expression={expression}
        mouth={mouth}
        tier={tier}
        gaze={gaze}
        reducedMotion={reducedMotion}
        onFps={onFps}
      />
    </Canvas>
  );
}
