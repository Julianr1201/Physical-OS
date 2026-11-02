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
      camera={{ position: [0, 0.28, 1.85], fov: 28 }}
      dpr={tier === 'low' ? 1 : tier === 'medium' ? 1.25 : [1, 1.5]}
      gl={{ alpha: false, antialias: tier === 'high', powerPreference: 'high-performance' }}
      onCreated={({ camera }) => camera.lookAt(-0.04, 0.3, 0.1)}
    >
      <color attach="background" args={['#101419']} />
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
