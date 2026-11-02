import type { CapabilityId } from './capabilities.js';
import type { CapabilityStateMap, Causation, CommandOutcome, PolicyDecision, SignalValue } from './domain.js';

export interface DomainEventBase {
  id: string;
  at: string;
  correlationId: string | null;
  causation: Causation | null;
}

export type DomainEvent =
  | (DomainEventBase & {
      type: 'device.discovered' | 'device.connected' | 'device.disconnected';
      deviceId: string;
      adapterId: string;
    })
  | (DomainEventBase & {
      type: 'device.state.changed';
      deviceId: string;
      capability: CapabilityId | null;
      observed: CapabilityStateMap;
    })
  | (DomainEventBase & {
      type: 'sensor.reading.received';
      deviceId: string;
      capability: CapabilityId;
      reading: unknown;
    })
  | (DomainEventBase & {
      type: 'environment.signal.changed';
      environmentId: string;
      signal: string;
      value: SignalValue;
    })
  | (DomainEventBase & {
      type: 'automation.triggered' | 'automation.failed';
      automationId: string;
      reason: string;
    })
  | (DomainEventBase & {
      type: 'command.requested' | 'command.authorized' | 'command.executed' | 'command.failed';
      commandId: string;
      deviceId: string;
      outcome: CommandOutcome;
      decision: PolicyDecision;
    });

export type DomainEventType = DomainEvent['type'];
