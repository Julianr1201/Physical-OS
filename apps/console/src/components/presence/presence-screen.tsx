'use client';

import Link from 'next/link';
import { useDeviceWeather } from '@/components/device-weather';
import { useFrame } from '@/components/shell';
import { Wallpaper } from '@/components/wallpaper';
import { weatherCopy } from '@/lib/device-weather';
import { presenceCopy } from './copy';
import { useSpark } from '@/components/spark/spark-session';
import { recordingIndicator } from '@physical-os/presence';
import { api } from '@/lib/api';

export function PresenceScreen() {
  const frame = useFrame();
  const spark = useSpark();
  const weather = useDeviceWeather();
  const outside = weatherCopy(frame.locale);
  const copy = presenceCopy(frame.locale);
  const forecast = weather.status === 'ready' ? weather.forecast : null;
  const weatherLine = forecast
    ? `${outside.outside} ${Math.round(forecast.celsius)}° · ${outside[forecast.kind]}`
    : weather.status === 'denied'
      ? outside.denied
      : weather.status === 'unavailable'
        ? outside.unavailable
        : outside.locating;
  const indicator = recordingIndicator(spark.privacy, spark.privacy.microphone);
  const simulated = frame.overview?.environments.some((environment) => environment.simulated) ?? false;
  const stateLabel = copy.states[spark.turn.state] ?? spark.turn.state;

  return (
    <div className="tv presence-stage !p-0" onClick={spark.wake}>
      <Wallpaper kind={forecast?.kind ?? null} day={forecast?.day ?? true} />
      <div className="presence-chrome pointer-events-none">
        <div className="flex flex-col gap-1 text-base">
          <p className="tv-display text-2xl">{copy.title}</p>
          {spark.role ? <p>{spark.role.disclosure} {spark.role.name}</p> : null}
          <p>{stateLabel}</p>
          {simulated ? <p className="text-[var(--text-secondary)]">{copy.simulated}</p> : null}
        </div>
        <p className="bg-[#151c22] px-3 py-2 text-base">{weatherLine}</p>
      </div>
      <p className="presence-caption" aria-live="polite">{spark.turn.line ?? copy.sparkHere}</p>
      {spark.turn.state === 'SLEEPING' ? <p className="presence-caption presence-caption-low">{copy.sleepHint}</p> : null}
      <aside className="presence-dock" onClick={(event) => event.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="min-h-12 bg-[var(--surface)] px-4 py-2 text-base" onClick={spark.toggleMicrophone}>
            {spark.privacy.microphone ? copy.stop : copy.talk}
          </button>
          <label className="flex min-h-12 items-center gap-2 bg-[var(--surface)] px-4 py-2 text-base">
            <input type="checkbox" checked={spark.privacy.cameraGaze} onChange={(event) => spark.toggleCamera(event.target.checked)} />
            {copy.cameraShort}
          </label>
          {weather.status === 'denied' ? (
            <button type="button" className="min-h-12 px-4 py-2 text-base" onClick={weather.retry}>{outside.retry}</button>
          ) : null}
          <Link href="/" className="px-3 py-2 text-base text-[var(--text-secondary)]">{copy.back}</Link>
          <Link href="/profiles" className="px-3 py-2 text-base text-[var(--text-secondary)]">{copy.roleLink}</Link>
        </div>
        {indicator !== 'off' ? (
          <p className="mt-3 flex items-center gap-2 text-base text-[var(--accent-warm)]">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent-warm)]" aria-hidden="true" />
            {indicator === 'both' ? copy.bothOn : indicator === 'camera' ? copy.cameraOn : copy.micOn}
          </p>
        ) : null}
        {spark.turn.speech === 'caption' ? <p className="mt-3 text-lg text-[var(--text-secondary)]">{copy.caption}</p> : null}
        {spark.turn.speech === 'gesture' ? <p className="mt-3 text-lg text-[var(--text-secondary)]">{copy.gestureNote}</p> : null}
        {spark.voiceGap ? <p className="mt-3 text-lg text-[var(--text-secondary)]">{copy.voiceGap}</p> : null}
        {spark.turn.state === 'ACTING' ? <p className="mt-3 text-lg text-[var(--accent-warm)]">{copy.point}</p> : null}
        {spark.engines && !spark.engines.hear ? <p className="mt-3 text-lg text-[var(--text-secondary)]">{copy.noAsr}</p> : null}
        {spark.engines && !spark.engines.speak && frame.locale !== 'es' ? <p className="mt-3 text-lg text-[var(--text-secondary)]">{copy.noTts}</p> : null}
        {spark.micNote ? <p className="mt-3 text-lg text-[var(--accent-warm)]">{spark.micNote}</p> : null}
        {spark.cameraNote ? <p className="mt-3 text-lg text-[var(--text-secondary)]">{spark.cameraNote}</p> : null}
        {frame.overview?.estop.latched ? <p className="mt-3 text-lg text-[var(--danger)]">{frame.overview.estop.reason}</p> : null}
        <div className="mt-3 flex flex-wrap gap-3">
          {spark.turn.state === 'SPEAKING' || spark.turn.state === 'ACTING' || spark.turn.state === 'THINKING' ? (
            <button type="button" className="bg-[var(--surface)] px-4 py-3 text-xl" onClick={() => spark.dispatch({ type: 'interrupt' })}>{copy.interrupt}</button>
          ) : null}
          {spark.turn.state === 'ACTING' ? (
            <>
              <button type="button" className="bg-[var(--surface-raised)] px-4 py-3 text-xl" onClick={() => void spark.confirm()}>{copy.confirm}</button>
              <button
                type="button"
                className="px-4 py-3 text-xl"
                onClick={() => {
                  const planId = spark.turn.planId;
                  spark.dispatch({ type: 'reject' });
                  if (planId) void api(`/api/v1/intelligence/${planId}/reject`, { method: 'POST' }).catch(() => undefined);
                }}
              >
                {copy.cancel}
              </button>
            </>
          ) : null}
          {spark.turn.state === 'ERROR' ? (
            <button type="button" className="bg-[var(--surface)] px-4 py-3 text-xl" onClick={() => spark.dispatch({ type: 'dismiss' })}>{copy.dismiss}</button>
          ) : null}
          {spark.turn.state === 'IDLE' ? (
            <button type="button" className="px-4 py-3 text-xl text-[var(--text-secondary)]" onClick={() => spark.dispatch({ type: 'preview', line: copy.gestureLine })}>{copy.gesture}</button>
          ) : null}
        </div>
        <details className="mt-3 text-base text-[var(--text-secondary)]">
          <summary>{copy.placeholder}</summary>
          <form
            className="mt-3 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              spark.submitText(spark.draft);
            }}
          >
            <label className="sr-only" htmlFor="presence-utterance">{copy.placeholder}</label>
            <textarea id="presence-utterance" rows={3} value={spark.draft} placeholder={copy.placeholder} onChange={(event) => spark.setDraft(event.target.value)} />
            <button type="submit" className="bg-[var(--surface)] px-4 py-3 text-left text-xl">{copy.send}</button>
          </form>
        </details>
        <details className="mt-3 text-base text-[var(--text-secondary)]">
          <summary>{copy.camera}</summary>
          <p className="mt-2">{copy.cameraHint}</p>
          <p className="mt-2">{spark.fps === null ? copy.measuring : copy.performance(spark.fps, copy.tiers[spark.tier])}</p>
        </details>
      </aside>
    </div>
  );
}
