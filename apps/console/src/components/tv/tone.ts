export interface ToneEngine {
  start(volume: number): void;
  setVolume(volume: number): void;
  stop(): void;
}

export function createBrowserTone(): ToneEngine {
  let context: AudioContext | null = null;
  let gain: GainNode | null = null;
  let oscillator: OscillatorNode | null = null;
  return {
    start(volume) {
      context ??= new AudioContext();
      if (oscillator) {
        gain?.gain.setValueAtTime(volume, context.currentTime);
        void context.resume();
        return;
      }
      gain = context.createGain();
      gain.gain.value = volume;
      gain.connect(context.destination);
      oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = 196;
      oscillator.connect(gain);
      oscillator.start();
      void context.resume();
    },
    setVolume(volume) {
      if (context && gain) gain.gain.setValueAtTime(volume, context.currentTime);
    },
    stop() {
      oscillator?.stop();
      oscillator?.disconnect();
      gain?.disconnect();
      oscillator = null;
      gain = null;
    },
  };
}
