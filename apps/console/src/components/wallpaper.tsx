'use client';

import { wallpaperScene, type WeatherKind } from '@/lib/device-weather';

export function Wallpaper({ kind, day }: { kind: WeatherKind | null; day: boolean }) {
  const scene = wallpaperScene(kind, day);
  return (
    <div className={`presence-sky presence-sky-${scene}`} aria-hidden="true">
      <div className="presence-sky-top" />
      <div className="presence-sky-band" />
      <div className="presence-sky-ground" />
      <div className="presence-sky-disc" />
      <div className="presence-sky-cloud" />
      <div className="presence-sky-rain" />
    </div>
  );
}
