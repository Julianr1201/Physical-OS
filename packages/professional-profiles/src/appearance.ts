export interface AvatarOption {
  id: string;
  label: { en: string; es: string };
}

export interface VoiceOption {
  id: string;
  label: { en: string; es: string };
  pace: 'calm' | 'measured' | 'brisk';
}

/** Visual identity is chosen separately from the profession. */
export const avatarCatalog: AvatarOption[] = [
  { id: 'figure-neutral', label: { en: 'Neutral figure', es: 'Figura neutra' } },
  { id: 'figure-hospitality', label: { en: 'Calm figure', es: 'Figura serena' } },
  { id: 'figure-commerce', label: { en: 'Clear figure', es: 'Figura clara' } },
  { id: 'figure-education', label: { en: 'Quiet figure', es: 'Figura pausada' } },
];

export const voiceCatalog: VoiceOption[] = [
  { id: 'voice-calm', label: { en: 'Calm', es: 'Calma' }, pace: 'calm' },
  { id: 'voice-measured', label: { en: 'Measured', es: 'Medida' }, pace: 'measured' },
  { id: 'voice-clear', label: { en: 'Clear', es: 'Clara' }, pace: 'brisk' },
];

export function avatarById(id: string): AvatarOption | null {
  return avatarCatalog.find((item) => item.id === id) ?? null;
}

export function voiceById(id: string): VoiceOption | null {
  return voiceCatalog.find((item) => item.id === id) ?? null;
}
