import { describe, expect, it } from 'vitest';
import { matchCue, openHandoff } from './index.js';

describe('human handoff', () => {
  it('matches a cue as data and records the person who should continue', () => {
    expect(matchCue(['bill', 'queja'], 'I want to dispute the bill.')).toBe('bill');
    const record = openHandoff({
      id: 'h1',
      profileId: 'hospitality.concierge',
      target: 'Front desk manager',
      reason: 'bill',
      at: '2026-11-01T18:00:00.000Z',
    });
    expect(record.target).toBe('Front desk manager');
  });
});
