import { describe, expect, it } from 'vitest';
import { decayLevel, sparkDensity, sparkMood, sparkRuntime, spanishFemaleVoice } from './spark.js';

describe('divine spark', () => {
  it('maps conversation states onto the light, and keeps offline visible', () => {
    expect(sparkMood('IDLE', 'neutral', 'ready')).toBe('IDLE');
    expect(sparkMood('LISTENING', 'attentive', 'ready')).toBe('LISTENING');
    expect(sparkMood('SPEAKING', 'neutral', 'ready')).toBe('SPEAKING');
    expect(sparkMood('IDLE', 'pleased', 'ready')).toBe('SUCCESS');
    expect(sparkMood('SLEEPING', 'neutral', 'ready')).toBe('DORMANT');
    expect(sparkMood('IDLE', 'neutral', 'offline')).toBe('OFFLINE');
  });

  it('thins the drawing on a low tier and eases the level back to rest', () => {
    expect(sparkDensity('low').motes).toBeLessThan(sparkDensity('high').motes);
    const mid = decayLevel(0.8, 0, 0.05);
    expect(mid).toBeLessThan(0.8);
    expect(decayLevel(mid, 0, 0.8)).toBeLessThan(0.05);
  });

  it('does not treat a Spanish male voice as the female voice, and does not claim a Mexican accent', () => {
    expect(spanishFemaleVoice([{ name: 'Microsoft Jorge', lang: 'es-MX' }])).toBeNull();
    expect(spanishFemaleVoice([{ name: 'Microsoft Sabina', lang: 'es-MX' }])?.name).toBe('Microsoft Sabina');
    expect(sparkRuntime.piper).toBeNull();
    expect(sparkRuntime.whisper).toBeNull();
    expect(sparkRuntime.mexicanAccentValidated).toBe(false);
  });
});
