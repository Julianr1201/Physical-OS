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
      camera={{ position: [0, 1.42, 1.85], fov: 28 }}
      dpr={tier === 'low' ? 1 : tier === 'medium' ? 1.25 : [1, 1.5]}
      gl={{ alpha: true, antialias: tier === 'high', powerPreference: 'high-performance' }}
      onCreated={({ gl, scene, camera }) => {
        scene.background = null;
        gl.setClearColor(0x000000, 0);
        camera.lookAt(0, 1.38, -0.06);
      }}
    >
        <ambientLight intensity={0.55} color="#DCEAF0" />
        <directionalLight position={[-0.35, 2.1, 1.7]} intensity={1.45} color="#F7FBFA" />
        <directionalLight position={[0.7, 1.3, 1.2]} intensity={0.4} color="#5E859A" />
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
