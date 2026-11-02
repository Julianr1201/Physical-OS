import { describe, expect, it } from 'vitest';
import { retrieveKnowledge } from './index.js';

describe('knowledge connectors', () => {
  const now = new Date('2026-11-01T18:00:00.000Z');

  it('returns hotel breakfast with provenance and a fresh stamp', () => {
    const [record] = retrieveKnowledge(['hotel.services'], 'What time is breakfast?', now);
    expect(record?.body.en).toContain('7:00');
    expect(record?.provenance).toBe('Simulated front-desk policy');
    expect(record?.fresh).toBe(true);
    expect(record?.uncertainty).toBe('stated');
  });

  it('marks an old price as partial', () => {
    const [record] = retrieveKnowledge(['commerce.catalog'], 'How much is the pastry?', now);
    expect(record?.fresh).toBe(false);
    expect(record?.uncertainty).toBe('partial');
  });
});
