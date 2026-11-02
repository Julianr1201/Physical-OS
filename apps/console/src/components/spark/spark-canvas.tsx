'use client';

import { useEffect, useRef } from 'react';
import { decayLevel, sparkDensity, type SparkMood } from '@physical-os/presence';
import type { PerformanceTier } from '@physical-os/presence';

export interface SparkLive {
  mood: SparkMood;
  tier: PerformanceTier;
  reduced: boolean;
  target: number;
  level: number;
}

export function SparkCanvas({ live, onFps }: { live: { current: SparkLive }; onFps: (fps: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const node = canvas.current;
    if (!node) return;
    const context = node.getContext('2d', { alpha: true });
    if (!context) return;
    let frame = 0;
    let windowSeconds = 0;
    let frames = 0;
    let last = performance.now();
    let stopped = false;

    const draw = (now: number) => {
      if (stopped) return;
      frame = window.requestAnimationFrame(draw);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (document.hidden) return;
      const current = live.current;
      current.level = current.reduced ? current.target : decayLevel(current.level, current.target, dt);
      frames += 1;
      windowSeconds += dt;
      if (windowSeconds >= 0.5) {
        onFps(Math.round(frames / windowSeconds));
        frames = 0;
        windowSeconds = 0;
      }
      const bounds = node.getBoundingClientRect();
      const cap = current.tier === 'low' ? 1 : current.tier === 'medium' ? 1.25 : 1.5;
      const dpr = Math.min(window.devicePixelRatio || 1, cap);
      const width = Math.max(1, Math.round(bounds.width * dpr));
      const height = Math.max(1, Math.round(bounds.height * dpr));
      if (node.width !== width || node.height !== height) {
        node.width = width;
        node.height = height;
      }
      paint(context, width, height, current, now / 1000);
    };
    frame = window.requestAnimationFrame(draw);
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
    };
  }, [live, onFps]);

  return <canvas ref={canvas} className="h-full w-full" aria-hidden="true" />;
}

function paint(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  live: SparkLive,
  time: number,
): void {
  context.clearRect(0, 0, width, height);
  const shortest = Math.min(width, height);
  const centerX = width / 2;
  const centerY = height / 2;
  const mood = live.mood;
  const level = live.level;
  const dim = mood === 'DORMANT' ? 0.38 : mood === 'OFFLINE' ? 0.55 : 1;
  const core = shortest * (mood === 'SPEAKING' || mood === 'SUCCESS' ? 0.075 : 0.062) * (1 + level * 0.18);
  const reach = shortest * (mood === 'LISTENING' ? 0.28 - level * 0.06 : 0.34 + level * 0.08);
  const { filaments, motes } = sparkDensity(live.tier);
  const spin = live.reduced ? 0.2 : mood === 'THINKING' ? 0.85 : mood === 'ACTING' ? 0.45 : 0.22;

  context.save();
  context.globalAlpha = dim;
  context.translate(centerX, centerY);
  context.lineWidth = Math.max(1, shortest * 0.004);
  context.lineCap = 'round';

  for (let index = 0; index < filaments; index += 1) {
    const phase = time * spin + (index / filaments) * Math.PI * 2;
    const amp = live.reduced ? shortest * 0.01 : shortest * (0.012 + level * 0.02);
    context.beginPath();
    const steps = live.tier === 'low' ? 28 : 42;
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const angle = phase + t * Math.PI * 2;
      const wave = Math.sin(angle * 3 + phase) * amp;
      const radius = reach * (0.55 + index * 0.08) + wave;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.78;
      if (step === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.strokeStyle = index % 2 === 0 ? '#d5e4ec' : '#8eacb8';
    context.globalAlpha = dim * (0.28 + level * 0.25);
    context.stroke();
  }

  if (!live.reduced) {
    for (let index = 0; index < motes; index += 1) {
      const angle = time * (0.35 + (index % 5) * 0.04) + index * 1.7;
      const radius = reach * (0.35 + (index % 4) * 0.12);
      context.globalAlpha = dim * 0.45;
      context.fillStyle = '#f4f1ea';
      context.beginPath();
      context.arc(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.78, Math.max(0.8, shortest * 0.004), 0, Math.PI * 2);
      context.fill();
    }
  }

  context.globalAlpha = dim;
  context.fillStyle = '#101419';
  context.beginPath();
  context.arc(0, 0, core * 2.4, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = mood === 'ERROR' ? '#c4a484' : '#f7f4ee';
  context.beginPath();
  context.arc(0, 0, core, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#d7e7ee';
  context.globalAlpha = dim * 0.9;
  context.stroke();
  context.restore();
}
