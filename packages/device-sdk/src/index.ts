import {
  DomainError,
  capabilityCatalog,
  getCapability,
  valuesMatch,
  type CapabilityId,
  type CapabilityStateMap,
} from '@physical-os/shared';

export interface ParsedAction {
  capability: CapabilityId;
  action: string;
  params: Record<string, unknown>;
  expectedState: Record<string, unknown> | null;
}

export function parseAction(
  capabilityId: string,
  action: string,
  params: unknown,
  currentState: unknown,
): ParsedAction {
  const capability = getCapability(capabilityId);
  if (!capability) {
    throw new DomainError('unknown_capability', `Unknown capability ${capabilityId}`, 422);
  }
  const schema = capability.actions[action];
  if (!schema) {
    throw new DomainError(
      'unsupported_capability',
      `${capability.id} does not support ${action}`,
      422,
    );
  }
  const parsed = schema.safeParse(params ?? {});
  if (!parsed.success) {
    throw new DomainError('malformed_command', 'Command parameters are invalid.', 422, {
      issues: parsed.error.issues.map((issue) => issue.message),
    });
  }
  const parsedParams = parsed.data as Record<string, unknown>;
  return {
    capability: capability.id,
    action,
    params: parsedParams,
    expectedState: expectedState(capability.id, action, parsedParams, currentState),
  };
}

export function parseObserved(capabilityId: CapabilityId, value: unknown): Record<string, unknown> {
  const capability = capabilityCatalog[capabilityId];
  const parsed = capability.stateSchema.safeParse(value);
  if (!parsed.success) {
    throw new DomainError('invalid_state', `Invalid ${capabilityId} state.`, 422);
  }
  return parsed.data as Record<string, unknown>;
}

export function expectedState(
  capabilityId: CapabilityId,
  action: string,
  params: Record<string, unknown>,
  currentState: unknown,
): Record<string, unknown> | null {
  if (action === 'toggle' && capabilityId === 'on_off') {
    const current = capabilityCatalog.on_off.stateSchema.safeParse(currentState);
    const on = current.success ? !current.data.on : true;
    return { on };
  }
  if (action === 'set') return params;
  return null;
}

export function stateVerified(
  expected: Record<string, unknown> | null,
  observed: unknown,
): boolean {
  if (!expected) return false;
  return valuesMatch(expected, observed);
}

export function sensorCapabilities(): CapabilityId[] {
  return (Object.keys(capabilityCatalog) as CapabilityId[]).filter(
    (id) => capabilityCatalog[id].readOnly,
  );
}

export function isSensor(capability: CapabilityId): boolean {
  return capabilityCatalog[capability].readOnly;
}

export function emptyState(capabilities: CapabilityId[]): CapabilityStateMap {
  const state: CapabilityStateMap = {};
  for (const capability of capabilities) {
    state[capability] = defaultState(capability);
  }
  return state;
}

function defaultState(capability: CapabilityId): Record<string, unknown> {
  switch (capability) {
    case 'on_off':
      return { on: false };
    case 'brightness':
      return { level: 0 };
    case 'temperature_sensor':
    case 'temperature_setpoint':
      return { celsius: 20 };
    case 'humidity_sensor':
    case 'battery':
      return { percent: 50 };
    case 'motion_sensor':
      return { detected: false };
    case 'power_meter':
      return { watts: 0 };
    case 'position':
      return { value: 0, unit: 'percent' };
    case 'media_control':
      return { playback: 'stop' };
    default:
      return {};
  }
}
