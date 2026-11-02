'use client';

import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import type { ExpressionName, PerformanceTier, PresenceState, SpeechCue } from '@physical-os/presence';
import { DigitalHuman } from './digital-human-view';
import { PresenceFigure } from './figure-view';

export function PresenceCanvas({
  state,
  expression,
  mouth,
  cue,
  gestureMouth,
  tier,
  gaze,
  reducedMotion,
  onFps,
}: {
  state: PresenceState;
  expression: ExpressionName;
  mouth: number;
  cue: SpeechCue | null;
  gestureMouth: number | null;
  tier: PerformanceTier;
  gaze: { x: number; y: number } | null;
  reducedMotion: boolean;
  onFps: (fps: number) => void;
}) {
  const [surface, setSurface] = useState<'human' | 'fallback'>('human');
  return (
    <Canvas
      camera={{ position: [0, 1.5, 1.35], fov: 26 }}
      dpr={tier === 'low' ? 1 : tier === 'medium' ? 1.25 : [1, 1.5]}
      gl={{ alpha: true, antialias: tier === 'high', powerPreference: 'high-performance' }}
      onCreated={({ gl, scene, camera }) => {
        scene.background = null;
        gl.setClearColor(0x000000, 0);
        camera.lookAt(0, 1.42, 0);
      }}
    >
      <ambientLight intensity={0.42} color="#d5e2ea" />
      <directionalLight position={[-0.55, 1.9, 1.8]} intensity={2.1} color="#fff4ea" />
      <directionalLight position={[1.1, 1.35, 1.2]} intensity={0.55} color="#8ea8b8" />
      <directionalLight position={[0.1, 1.7, -1.6]} intensity={0.7} color="#d7e6ee" />
      {surface === 'human' ? (
        <DigitalHuman
          state={state}
          expression={expression}
          cue={cue}
          gestureMouth={gestureMouth}
          tier={tier}
          gaze={gaze}
          reducedMotion={reducedMotion}
          onFailed={() => setSurface('fallback')}
          onFps={onFps}
        />
      ) : (
        <PresenceFigure
          state={state}
          expression={expression}
          mouth={mouth}
          tier={tier}
          gaze={gaze}
          reducedMotion={reducedMotion}
          onFps={onFps}
        />
      )}
    </Canvas>
  );
}
