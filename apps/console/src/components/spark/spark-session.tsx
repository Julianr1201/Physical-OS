'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  chooseTier,
  createVad,
  defaultPrivacy,
  gestureMouth,
  initialTurn,
  isEcho,
  lineForExecution,
  reduceTurn,
  replyFromInterpret,
  setCameraGaze,
  setMicrophone,
  sparkMood,
  spanishFemaleVoice,
  stepVad,
  visemeFromBoundary,
  type InterpretResult,
  type PresenceTurn,
  type PrivacySettings,
  type TurnEvent,
} from '@physical-os/presence';
import { api } from '@/lib/api';
import { useFrame } from '@/components/shell';
import { groundUtterance, matchRoom } from '@/lib/room-status';
import { startCameraGaze } from '@/components/presence/camera-gaze';
import { presenceCopy, type PresenceCopy } from '@/components/presence/copy';
import { browserProvider, listenBrowser, openMicrophoneMeter, speakBrowser } from '@/components/presence/speech-browser';
import { SparkCanvas, type SparkLive } from './spark-canvas';

interface SparkApi {
  turn: PresenceTurn;
  privacy: PrivacySettings;
  draft: string;
  setDraft: (value: string) => void;
  micNote: string | null;
  cameraNote: string | null;
  engines: { hear: boolean; speak: boolean } | null;
  role: { name: string; disclosure: string } | null;
  fps: number | null;
  tier: 'high' | 'medium' | 'low';
  reducedMotion: boolean;
  voiceGap: boolean;
  dispatch: (event: TurnEvent) => PresenceTurn;
  setPrivacy: (next: PrivacySettings) => void;
  submitText: (text: string) => void;
  confirm: () => Promise<void>;
  wake: () => void;
  toggleMicrophone: () => void;
  toggleCamera: (enabled: boolean) => void;
}

const SparkContext = createContext<SparkApi | null>(null);

export function useSpark(): SparkApi {
  const value = useContext(SparkContext);
  if (!value) throw new Error('Spark missing');
  return value;
}

export function SparkSession({ children }: { children: ReactNode }) {
  const frame = useFrame();
  const copy = presenceCopy(frame.locale);
  const [turn, setTurn] = useState<PresenceTurn>(initialTurn);
  const [privacy, setPrivacy] = useState(defaultPrivacy);
  const [draft, setDraft] = useState('');
  const [fps, setFps] = useState<number | null>(null);
  const [hardware, setHardware] = useState({ cores: 4, memoryGb: null as number | null });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const [engines, setEngines] = useState<{ hear: boolean; speak: boolean } | null>(null);
  const [role, setRole] = useState<{ name: string; disclosure: string } | null>(null);
  const [voiceGap, setVoiceGap] = useState(false);
  const enginesRef = useRef({ hear: false, speak: false });
  const turnRef = useRef(turn);
  const copyRef = useRef(copy);
  const overviewRef = useRef(frame.overview);
  const abortRef = useRef<AbortController | null>(null);
  const speakAt = useRef(0);
  const vad = useRef(createVad());
  const live = useRef<SparkLive>({ mood: 'IDLE', tier: 'medium', reduced: false, target: 0, level: 0 });
  const onFps = useCallback((value: number) => setFps(value), []);
  turnRef.current = turn;
  copyRef.current = copy;
  overviewRef.current = frame.overview;
  const tier = chooseTier({ cores: hardware.cores, memoryGb: hardware.memoryGb, measuredFps: fps });
  live.current.mood = sparkMood(turn.state, turn.expression, frame.error ? 'offline' : 'ready');
  live.current.tier = tier;
  live.current.reduced = reducedMotion;
  if (turn.speech !== 'playing' && turn.speech !== 'gesture' && !privacy.microphone) live.current.target = 0;

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
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyMotion = () => setReducedMotion(media.matches);
    applyMotion();
    media.addEventListener('change', applyMotion);
    const wake = window.setTimeout(() => dispatch({ type: 'awaken' }), 350);
    const ready = window.setTimeout(() => dispatch({ type: 'ready' }), 1500);
    return () => {
      media.removeEventListener('change', applyMotion);
      window.clearTimeout(wake);
      window.clearTimeout(ready);
    };
  }, [dispatch]);

  useEffect(() => {
    const readVoices = () => {
      const hear = browserProvider('recognition').available;
      const voices = window.speechSynthesis?.getVoices().map((voice) => ({ name: voice.name, lang: voice.lang })) ?? [];
      const female = frame.locale === 'es' ? spanishFemaleVoice(voices) : null;
      const speak = frame.locale === 'es' ? female !== null : browserProvider('synthesis').available;
      enginesRef.current = { hear, speak };
      setEngines({ hear, speak });
      setVoiceGap(frame.locale === 'es' && !speak);
    };
    readVoices();
    window.speechSynthesis?.addEventListener('voiceschanged', readVoices);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', readVoices);
  }, [frame.locale]);

  useEffect(() => {
    void api<{ role: { en: string; es: string }; disclosure: { en: string; es: string } } | null>('/api/v1/profiles/active')
      .then((data) => setRole(data ? { name: data.role[frame.locale], disclosure: data.disclosure[frame.locale] } : null))
      .catch(() => setRole(null));
  }, [frame.locale]);

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
    const voices = window.speechSynthesis?.getVoices().map((voice) => ({ name: voice.name, lang: voice.lang })) ?? [];
    const female = frame.locale === 'es' ? spanishFemaleVoice(voices) : null;
    void speakBrowser(line, frame.locale === 'es' ? 'es-MX' : 'en-US', controller.signal, (index) => {
      live.current.target = visemeFromBoundary(line, index).mouth;
    }, female).then((result) => {
      live.current.target = 0;
      if (result === 'ended') dispatch({ type: 'speech_ended', generation });
    });
    return () => {
      controller.abort();
      live.current.target = 0;
    };
  }, [turn.speech, turn.generation, turn.line, engines, frame.locale, dispatch]);

  useEffect(() => {
    if (turn.speech !== 'gesture' || !turn.line) return;
    const generation = turn.generation;
    const duration = Math.min(3600, 700 + turn.line.length * 40);
    const started = performance.now();
    let frameId = 0;
    const tick = () => {
      const elapsed = performance.now() - started;
      live.current.target = gestureMouth(elapsed, duration);
      if (elapsed < duration) frameId = window.requestAnimationFrame(tick);
      else {
        live.current.target = 0;
        dispatch({ type: 'speech_ended', generation });
      }
    };
    frameId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameId);
      live.current.target = 0;
    };
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
      live.current.target = Math.min(1, rms * 14);
      const loud = turnRef.current.speech === 'playing' ? 0.08 : 0.045;
      vad.current = stepVad(vad.current, rms, performance.now(), loud, 180);
      if (vad.current.active) bargeIn();
    }).catch(() => setMicNote(copyRef.current.noAsr));
    return () => {
      controller.abort();
      recognition?.stop();
      vad.current = createVad();
      live.current.target = 0;
    };
    function bargeIn() {
      const state = turnRef.current.state;
      if (state !== 'SPEAKING' && state !== 'ACTING') return;
      if (performance.now() - speakAt.current < 700) return;
      dispatch({ type: 'interrupt' });
    }
  }, [privacy.microphone, frame.locale, dispatch]);

  useEffect(() => {
    if (!privacy.cameraGaze) return;
    const controller = new AbortController();
    void startCameraGaze(controller.signal, () => undefined).catch(() => {
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

  const apiValue = useMemo<SparkApi>(
    () => ({
      turn,
      privacy,
      draft,
      setDraft,
      micNote,
      cameraNote,
      engines,
      role,
      fps,
      tier,
      reducedMotion,
      voiceGap,
      dispatch,
      setPrivacy,
      submitText,
      confirm,
      wake,
      toggleMicrophone: () => {
        setMicNote(null);
        setPrivacy((current) => setMicrophone(current, !current.microphone));
      },
      toggleCamera: (enabled: boolean) => {
        setCameraNote(null);
        setPrivacy((current) => setCameraGaze(current, enabled));
      },
    }),
    [turn, privacy, draft, micNote, cameraNote, engines, role, fps, tier, reducedMotion, voiceGap, dispatch],
  );

  return (
    <SparkContext.Provider value={apiValue}>
      {children}
      <SparkOverlay live={live} onFps={onFps} copy={copy} />
    </SparkContext.Provider>
  );
}

function SparkOverlay({
  live,
  onFps,
  copy,
}: {
  live: { current: SparkLive };
  onFps: (fps: number) => void;
  copy: PresenceCopy;
}) {
  const pathname = usePathname();
  const spark = useSpark();
  const immersive = pathname === '/presence';
  return (
    <div className={immersive ? 'spark-immersive' : 'spark-compact'}>
      <SparkCanvas live={live} onFps={onFps} />
      {immersive ? null : (
        <Link href="/presence" className="spark-hit" aria-label={copy.title}>
          <span className="sr-only">{spark.turn.line ?? copy.sparkHere}</span>
        </Link>
      )}
    </div>
  );
}
