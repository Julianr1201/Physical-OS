export interface ProviderSlot {
  id: 'browser' | 'local' | 'remote' | 'none';
  available: boolean;
  streaming: boolean;
  reason: string | null;
}

export function absentProvider(channel: 'recognition' | 'synthesis'): ProviderSlot {
  return {
    id: 'none',
    available: false,
    streaming: false,
    reason: `${channel} is not available on this device`,
  };
}

export function acceptProvider(slot: ProviderSlot | null, channel: 'recognition' | 'synthesis'): ProviderSlot {
  if (!slot?.available) return absentProvider(channel);
  return { ...slot, reason: null };
}
