'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  chooseTier,
  createVad,
  defaultPrivacy,
  stepVad,
  gestureMouth,
  initialTurn,
  isEcho,
  lineForExecution,
  visemeFromBoundary,
  recordingIndicator,
  reduceTurn,
  replyFromInterpret,
  setCameraGaze,
  setMicrophone,
  type InterpretResult,
  type PresenceTurn,
  type TurnEvent,
} from '@physical-os/presence';
import { api } from '@/lib/api';
import { useFrame } from '@/components/shell';
import { groundUtterance, matchRoom } from '@/lib/room-status';
import { startCameraGaze } from './camera-gaze';
import { presenceCopy } from './copy';
import { browserProvider, listenBrowser, openMicrophoneMeter, playSoftTone, speakBrowser } from './speech-browser';

const PresenceCanvas = dynamic(() => import('./canvas').then((mod) => mod.PresenceCanvas), { ssr: false });

export function PresenceScreen() {
  const frame = useFrame();
  const copy = presenceCopy(frame.locale);
  const [turn, setTurn] = useState<PresenceTurn>(initialTurn);
  const [privacy, setPrivacy] = useState(defaultPrivacy);
  const [draft, setDraft] = useState('');
  const [mouth, setMouth] = useState(0);
  const [gaze, setGaze] = useState<{ x: number; y: number } | null>(null);
  const [fps, setFps] = useState<number | null>(null);
  const [hardware, setHardware] = useState({ cores: 4, memoryGb: null as number | null });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const [engines, setEngines] = useState<{ hear: boolean; speak: boolean } | null>(null);
  const [role, setRole] = useState<{ name: string; disclosure: string } | null>(null);
  const enginesRef = useRef({ hear: false, speak: false });
  const turnRef = useRef(turn);
  const copyRef = useRef(copy);
  const overviewRef = useRef(frame.overview);
  const abortRef = useRef<AbortController | null>(null);
  const speakAt = useRef(0);
  const vad = useRef(createVad());
  turnRef.current = turn;
  copyRef.current = copy;
  overviewRef.current = frame.overview;

  const dispatch = useCallback((event: TurnEvent) => {
    const effect = reduceTurn(turnRef.current, event);
    turnRef.current = effect.turn;
    setTurn(effect.turn);
    if (effect.cancelSpeech) abortRef.current?.abort();
    if (effect.discardPlanId) {
      void api(`/api/v1/intelligence/${effect.discardPlanId}/reject`, { method: 'POST' }).catch(() => undefined);
    }
    return effect.turn;
  }, []);

  useEffect(() => {
    const device = navigator as Navigator & { deviceMemory?: number };
    setHardware({ cores: navigator.hardwareConcurrency || 4, memoryGb: device.deviceMemory ?? null });
    const detected = { hear: browserProvider('recognition').available, speak: browserProvider('synthesis').available };
    enginesRef.current = detected;
    setEngines(detected);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener('change', apply);
    const wake = window.setTimeout(() => dispatch({ type: 'awaken' }), 350);
    const ready = window.setTimeout(() => dispatch({ type: 'ready' }), 1500);
    return () => {
      media.removeEventListener('change', apply);
      window.clearTimeout(wake);
      window.clearTimeout(ready);
    };
  }, [dispatch]);

  useEffect(() => {
    void api<{ role: { en: string; es: string }; disclosure: { en: string; es: string } } | null>('/api/v1/profiles/active')
      .then((data) => setRole(data ? { name: data.role[frame.locale], disclosure: data.disclosure[frame.locale] } : null))
      .catch(() => setRole(null));
  }, [frame.locale]);

  useEffect(() => {
    if (turn.state !== 'AWAKENING' && turn.state !== 'ERROR') return;
    try {
      playSoftTone();
    } catch {
      return;
    }
  }, [turn.state]);

  useEffect(() => {
    if (turn.state !== 'IDLE') return;
    const timer = window.setTimeout(() => dispatch({ type: 'sleep' }), 70_000);
    return () => window.clearTimeout(timer);
  }, [turn.state, turn.generation, dispatch]);

  useEffect(() => {
    if (turn.speech !== 'playing' || !turn.line || !enginesRef.current.speak) return;
    const generation = turn.generation;
    const line = turn.line;
    const controller = new AbortController();
    abortRef.current = controller;
    speakAt.current = performance.now();
    void speakBrowser(line, frame.locale === 'es' ? 'es-MX' : 'en-US', controller.signal, (index) => {
      setMouth(visemeFromBoundary(line, index).mouth);
    }).then((result) => {
      if (result === 'ended') dispatch({ type: 'speech_ended', generation });
      setMouth(0);
    });
    return () => controller.abort();
  }, [turn.speech, turn.generation, turn.line, engines, frame.locale, dispatch]);

  useEffect(() => {
    if (turn.speech !== 'gesture' || !turn.line) return;
    const generation = turn.generation;
    const duration = Math.min(3600, 700 + turn.line.length * 40);
    const started = performance.now();
    let frameId = 0;
    const tick = () => {
      const elapsed = performance.now() - started;
      setMouth(gestureMouth(elapsed, duration));
      if (elapsed < duration) frameId = window.requestAnimationFrame(tick);
      else {
        setMouth(0);
        dispatch({ type: 'speech_ended', generation });
      }
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [turn.speech, turn.generation, turn.line, dispatch]);

  useEffect(() => {
    if (!privacy.microphone) return;
    const controller = new AbortController();
    const lang = frame.locale === 'es' ? 'es-MX' : 'en-US';
    const current = turnRef.current;
    if (current.state === 'SPEAKING' || current.state === 'ACTING' || (current.state === 'THINKING' && current.planId === null)) {
      dispatch({ type: 'interrupt' });
    } else if (current.state === 'SLEEPING' || current.state === 'DORMANT') {
      dispatch({ type: 'awaken' });
      dispatch({ type: 'ready' });
      dispatch({ type: 'listen' });
    } else if (current.state === 'ERROR') {
      dispatch({ type: 'dismiss' });
      dispatch({ type: 'listen' });
    } else if (current.state === 'IDLE') {
      dispatch({ type: 'listen' });
    }
    const recognition = listenBrowser(lang, {
      onSpeechStart: () => bargeIn(),
      onFinal: (text) => {
        if (isEcho(text, turnRef.current.line)) return;
        if (turnRef.current.state === 'SPEAKING' || turnRef.current.state === 'ACTING') bargeIn();
        if (turnRef.current.state !== 'LISTENING') return;
        const generation = turnRef.current.generation;
        dispatch({ type: 'heard' });
        void ask(text, generation);
      },
      onError: (code) => setMicNote(code),
    });
    if (!recognition) setMicNote(copyRef.current.noAsr);
    void openMicrophoneMeter(controller.signal, (rms) => {
      const loud = turnRef.current.speech === 'playing' ? 0.08 : 0.045;
      vad.current = stepVad(vad.current, rms, performance.now(), loud, 180);
      if (vad.current.active) bargeIn();
    }).catch(() => setMicNote(copyRef.current.noAsr));
    return () => {
      controller.abort();
      recognition?.stop();
      vad.current = createVad();
    };
    function bargeIn() {
      const state = turnRef.current.state;
      if (state !== 'SPEAKING' && state !== 'ACTING') return;
      if (performance.now() - speakAt.current < 700) return;
      dispatch({ type: 'interrupt' });
    }
  }, [privacy.microphone, frame.locale, dispatch]);

  useEffect(() => {
    if (!privacy.cameraGaze) {
      setGaze(null);
      return;
    }
    const controller = new AbortController();
    void startCameraGaze(controller.signal, (x, y) => setGaze({ x, y })).catch(() => {
      setCameraNote(copyRef.current.cameraHint);
      setPrivacy((current) => setCameraGaze(current, false));
    });
    return () => controller.abort();
  }, [privacy.cameraGaze]);

  async function ask(text: string, generation: number) {
    const overview = overviewRef.current;
    const environment = overview?.environments[0];
    if (!environment || !overview) {
      dispatch({ type: 'fail', message: copyRef.current.noHouse });
      return;
    }
    const placeId = window.localStorage.getItem('pos-tv-place') ?? 'sala';
    const custom = window.localStorage.getItem('pos-tv-custom') ?? '';
    const room = matchRoom(overview.rooms, placeId, custom);
    try {
      const result = await api<InterpretResult>('/api/v1/intelligence/interpret', {
        method: 'POST',
        body: JSON.stringify({ environmentId: environment.id, utterance: groundUtterance(text, placeId, room?.name ?? null) }),
      });
      if (turnRef.current.generation !== generation || turnRef.current.state !== 'THINKING') return;
      dispatch({ type: 'reply', generation, canSpeak: enginesRef.current.speak, reply: replyFromInterpret(result) });
    } catch (error) {
      if (turnRef.current.generation !== generation) return;
      dispatch({ type: 'fail', message: error instanceof Error ? error.message : copyRef.current.failed });
    }
  }

  function submitText(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    let current = turnRef.current;
    if (current.state === 'SPEAKING' || current.state === 'THINKING' || current.state === 'ACTING') current = dispatch({ type: 'interrupt' });
    if (current.state === 'DORMANT' || current.state === 'SLEEPING') {
      dispatch({ type: 'awaken' });
      current = dispatch({ type: 'ready' });
    }
    if (current.state === 'ERROR') current = dispatch({ type: 'dismiss' });
    if (current.state === 'IDLE') current = dispatch({ type: 'listen' });
    if (turnRef.current.state !== 'LISTENING') return;
    const generation = turnRef.current.generation;
    dispatch({ type: 'heard' });
    setDraft('');
    void ask(trimmed, generation);
  }

  async function confirm() {
    const planId = turnRef.current.planId;
    if (!planId || turnRef.current.state !== 'ACTING') return;
    const generation = turnRef.current.generation + 1;
    dispatch({ type: 'approve' });
    try {
      const execution = await api<{ explanation: string; commands: Array<{ verified: boolean; outcome: string; errorMessage: string | null }> }>(
        `/api/v1/intelligence/${planId}/approve`,
        { method: 'POST' },
      );
      const outcome = lineForExecution(execution.commands, execution.explanation, { sent: copyRef.current.sent, failed: copyRef.current.failed });
      dispatch({ type: 'settled', generation, canSpeak: enginesRef.current.speak, line: outcome.line, expression: outcome.expression });
    } catch (error) {
      dispatch({ type: 'fail', message: error instanceof Error ? error.message : copyRef.current.failed });
    }
  }

  function wake() {
    const state = turnRef.current.state;
    if (state !== 'SLEEPING' && state !== 'DORMANT') return;
    dispatch({ type: 'awaken' });
    window.setTimeout(() => dispatch({ type: 'ready' }), 900);
  }

  const tier = chooseTier({ cores: hardware.cores, memoryGb: hardware.memoryGb, measuredFps: fps });
  const indicator = recordingIndicator(privacy, privacy.microphone);
  const simulated = frame.overview?.environments.some((environment) => environment.simulated) ?? false;
  const stateLabel = copy.states[turn.state] ?? turn.state;

  return (
    <div className="tv grid min-h-screen !p-0 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="relative min-h-[62vh] bg-[#101419] lg:min-h-screen" onClick={wake}>
        <FigureBoundary fallback={<p className="grid h-full place-items-center px-8 text-xl text-[var(--text-secondary)]">{copy.noWebgl}</p>}>
          <PresenceCanvas
            state={turn.state}
            expression={turn.expression}
            mouth={mouth}
            tier={tier}
            gaze={privacy.cameraGaze ? gaze : null}
            reducedMotion={reducedMotion}
            onFps={setFps}
          />
        </FigureBoundary>
        <div className="pointer-events-none absolute left-6 top-6 flex flex-col gap-2 text-lg">
          <p className="tv-display text-3xl">{copy.title}</p>
          {role ? <p>{role.disclosure} {role.name}</p> : null}
          <p>{stateLabel}</p>
          {simulated ? <p className="text-[var(--text-secondary)]">{copy.simulated}</p> : null}
          {indicator !== 'off' ? (
            <p className="flex items-center gap-2 text-[var(--accent-warm)]">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent-warm)]" aria-hidden="true" />
              {indicator === 'both' ? copy.bothOn : indicator === 'camera' ? copy.cameraOn : copy.micOn}
            </p>
          ) : null}
        </div>
        {turn.state === 'SLEEPING' ? <p className="absolute bottom-6 left-6 text-lg text-[var(--text-secondary)]">{copy.sleepHint}</p> : null}
      </section>
      <aside className="flex flex-col gap-5 border-t border-[var(--border-subtle)] bg-[#1b242d] p-6 lg:border-l lg:border-t-0">
        <div className="flex gap-4">
          <Link href="/" className="text-lg text-[var(--text-secondary)]">{copy.back}</Link>
          <Link href="/profiles" className="text-lg text-[var(--text-secondary)]">{copy.roleLink}</Link>
        </div>
        <p className="min-h-16 text-2xl leading-snug">{turn.line}</p>
        {turn.speech === 'caption' ? <p className="text-lg text-[var(--text-secondary)]">{copy.caption}</p> : null}
        {turn.speech === 'gesture' ? <p className="text-lg text-[var(--text-secondary)]">{copy.gestureNote}</p> : null}
        {turn.state === 'ACTING' ? <p className="text-lg text-[var(--accent-warm)]">{copy.point}</p> : null}
        {engines && !engines.hear ? <p className="text-lg text-[var(--text-secondary)]">{copy.noAsr}</p> : null}
        {engines && !engines.speak ? <p className="text-lg text-[var(--text-secondary)]">{copy.noTts}</p> : null}
        {micNote ? <p className="text-lg text-[var(--accent-warm)]">{micNote}</p> : null}
        {cameraNote ? <p className="text-lg text-[var(--text-secondary)]">{cameraNote}</p> : null}
        {frame.overview?.estop.latched ? <p className="text-lg text-[var(--danger)]">{frame.overview.estop.reason}</p> : null}
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            submitText(draft);
          }}
        >
          <label className="sr-only" htmlFor="presence-utterance">{copy.placeholder}</label>
          <textarea
            id="presence-utterance"
            rows={3}
            value={draft}
            placeholder={copy.placeholder}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className="bg-[var(--surface)] px-4 py-3 text-left text-xl">{copy.send}</button>
        </form>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="bg-[var(--surface)] px-4 py-3 text-xl"
            onClick={() => {
              setMicNote(null);
              setPrivacy((current) => setMicrophone(current, !current.microphone));
            }}
          >
            {privacy.microphone ? copy.stop : copy.talk}
          </button>
          {turn.state === 'SPEAKING' || turn.state === 'ACTING' || turn.state === 'THINKING' ? (
            <button type="button" className="bg-[var(--surface)] px-4 py-3 text-xl" onClick={() => dispatch({ type: 'interrupt' })}>{copy.interrupt}</button>
          ) : null}
          {turn.state === 'ACTING' ? (
            <>
              <button type="button" className="bg-[var(--surface-raised)] px-4 py-3 text-xl" onClick={() => void confirm()}>{copy.confirm}</button>
              <button
                type="button"
                className="px-4 py-3 text-xl"
                onClick={() => {
                  const planId = turnRef.current.planId;
                  dispatch({ type: 'reject' });
                  if (planId) void api(`/api/v1/intelligence/${planId}/reject`, { method: 'POST' }).catch(() => undefined);
                }}
              >
                {copy.cancel}
              </button>
            </>
          ) : null}
          {turn.state === 'ERROR' ? (
            <button type="button" className="bg-[var(--surface)] px-4 py-3 text-xl" onClick={() => dispatch({ type: 'dismiss' })}>{copy.dismiss}</button>
          ) : null}
          {turn.state === 'IDLE' ? (
            <button type="button" className="px-4 py-3 text-xl text-[var(--text-secondary)]" onClick={() => dispatch({ type: 'preview', line: copy.gestureLine })}>{copy.gesture}</button>
          ) : null}
        </div>
        <label className="grid gap-2 text-lg">
          <span className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={privacy.cameraGaze}
              onChange={(event) => {
                setCameraNote(null);
                setPrivacy((current) => setCameraGaze(current, event.target.checked));
              }}
            />
            {copy.camera}
          </span>
          <span className="text-[var(--text-secondary)]">{copy.cameraHint}</span>
        </label>
        <p className="mt-auto text-lg text-[var(--text-secondary)]">
          {fps === null ? copy.measuring : copy.performance(fps, copy.tiers[tier])}
        </p>
      </aside>
    </div>
  );
}

class FigureBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
