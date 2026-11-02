import { describe, expect, it } from 'vitest';
import { parseAction, stateVerified } from './index.js';

describe('device capability validation', () => {
  it('rejects unsupported actions and malformed parameters', () => {
    expect(() => parseAction('temperature_sensor', 'set', { celsius: 22 }, {})).toThrow(
      /does not support/,
    );
    expect(() => parseAction('on_off', 'set', { on: 'yes' }, {})).toThrow(/invalid/i);
    expect(() => parseAction('nope', 'set', {}, {})).toThrow(/Unknown capability/);
  });

  it('predicts toggle from the current observed state', () => {
    const parsed = parseAction('on_off', 'toggle', {}, { on: true });
    expect(parsed.expectedState).toEqual({ on: false });
    expect(stateVerified(parsed.expectedState, { on: false })).toBe(true);
    expect(stateVerified(parsed.expectedState, { on: true })).toBe(false);
  });
});
