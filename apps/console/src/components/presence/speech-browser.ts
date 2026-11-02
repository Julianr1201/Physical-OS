import { absentProvider, acceptProvider, type ProviderSlot } from '@physical-os/presence';

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}

interface BrowserRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onspeechstart: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function browserProvider(kind: 'recognition' | 'synthesis'): ProviderSlot {
  if (typeof window === 'undefined') return absentProvider(kind);
  if (kind === 'recognition') {
    const available = recognitionConstructor() !== null;
    return acceptProvider(available ? { id: 'browser', available: true, streaming: true, reason: null } : null, kind);
  }
  const available = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance === 'function';
  return acceptProvider(available ? { id: 'browser', available: true, streaming: false, reason: null } : null, kind);
}

export function listenBrowser(
  lang: string,
  handlers: { onSpeechStart: () => void; onFinal: (text: string) => void; onError: (code: string) => void },
): { stop: () => void } | null {
  const Constructor = recognitionConstructor();
  if (!Constructor) return null;
  const recognition = new Constructor();
  let stopped = false;
  recognition.lang = lang;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onspeechstart = () => handlers.onSpeechStart();
  recognition.onresult = (event) => {
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index];
      const transcript = result?.[0]?.transcript?.trim();
      if (result?.isFinal && transcript) handlers.onFinal(transcript);
    }
  };
  recognition.onerror = (event) => {
    if (event.error === 'aborted' || event.error === 'no-speech') return;
    handlers.onError(event.error);
  };
  recognition.onend = () => {
    if (stopped) return;
    try {
      recognition.start();
    } catch {
      stopped = true;
    }
  };
  try {
    recognition.start();
  } catch {
    return null;
  }
  return {
    stop() {
      stopped = true;
      recognition.onend = null;
      recognition.abort();
    },
  };
}

export function speakBrowser(
  text: string,
  lang: string,
  signal: AbortSignal,
  onBoundary: (charIndex: number) => void,
  voice: { name: string; lang: string } | null = null,
): Promise<'ended' | 'cancelled'> {
  if (signal.aborted || typeof window.speechSynthesis === 'undefined' || typeof window.SpeechSynthesisUtterance !== 'function') {
    return Promise.resolve('cancelled');
  }
  if (lang.toLowerCase().startsWith('es') && !voice) return Promise.resolve('cancelled');
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice?.lang || lang;
    const match = voice ? window.speechSynthesis.getVoices().find((item) => item.name === voice.name && item.lang === voice.lang) : undefined;
    if (match) utterance.voice = match;
    utterance.rate = 1;
    utterance.onboundary = (event) => onBoundary(event.charIndex ?? 0);
    const finish = (result: 'ended' | 'cancelled') => {
      signal.removeEventListener('abort', cancel);
      resolve(result);
    };
    const cancel = () => {
      window.speechSynthesis.cancel();
      finish('cancelled');
    };
    utterance.onend = () => finish('ended');
    utterance.onerror = () => finish(signal.aborted ? 'cancelled' : 'ended');
    signal.addEventListener('abort', cancel, { once: true });
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

export async function openMicrophoneMeter(signal: AbortSignal, onRms: (rms: number) => void): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: false,
  });
  if (signal.aborted) {
    stream.getTracks().forEach((track) => track.stop());
    return;
  }
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const bins = new Float32Array(analyser.fftSize);
  let timer = 0;
  const stop = () => {
    window.clearTimeout(timer);
    stream.getTracks().forEach((track) => track.stop());
    void context.close();
  };
  const tick = () => {
    if (signal.aborted) return;
    analyser.getFloatTimeDomainData(bins);
    let sum = 0;
    for (const sample of bins) sum += sample * sample;
    onRms(Math.sqrt(sum / bins.length));
    timer = window.setTimeout(tick, 50);
  };
  signal.addEventListener('abort', stop, { once: true });
  tick();
}

export function playSoftTone(): void {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = 196;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.025, context.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.26);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.28);
  oscillator.onended = () => {
    void context.close();
  };
}

function recognitionConstructor(): (new () => BrowserRecognition) | null {
  const agent = window as Window & {
    SpeechRecognition?: new () => BrowserRecognition;
    webkitSpeechRecognition?: new () => BrowserRecognition;
  };
  return agent.SpeechRecognition ?? agent.webkitSpeechRecognition ?? null;
}
