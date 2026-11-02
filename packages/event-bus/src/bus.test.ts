import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { EventBus } from './bus.js';
import type { DomainEvent } from '@physical-os/shared';

function event(type: DomainEvent['type']): DomainEvent {
  return {
    type,
    id: randomUUID(),
    at: new Date().toISOString(),
    correlationId: null,
    causation: null,
    deviceId: randomUUID(),
    adapterId: 'simulator',
  } as DomainEvent;
}

describe('EventBus', () => {
  it('drains events emitted by a handler before publish resolves', async () => {
    const bus = new EventBus();
    const seen: string[] = [];
    bus.subscribe('device.connected', () => {
      seen.push('connected');
      bus.publish(event('device.disconnected'));
    });
    bus.subscribe('device.disconnected', () => {
      seen.push('disconnected');
    });
    bus.publish(event('device.connected'));
    await bus.whenIdle();
    expect(seen).toEqual(['connected', 'disconnected']);
  });
});
