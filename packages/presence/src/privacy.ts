export interface PrivacySettings {
  microphone: boolean;
  cameraGaze: boolean;
  retainMedia: false;
}

export function defaultPrivacy(): PrivacySettings {
  return { microphone: false, cameraGaze: false, retainMedia: false };
}

export function setMicrophone(settings: PrivacySettings, enabled: boolean): PrivacySettings {
  return { ...settings, microphone: enabled, retainMedia: false };
}

export function setCameraGaze(settings: PrivacySettings, enabled: boolean): PrivacySettings {
  return { ...settings, cameraGaze: enabled, retainMedia: false };
}

export function assertNoRetention(settings: PrivacySettings): void {
  if (settings.retainMedia !== false) throw new Error('media_retention_disabled');
}

export type RecordingIndicator = 'off' | 'microphone' | 'camera' | 'both';

export function recordingIndicator(settings: PrivacySettings, listening: boolean): RecordingIndicator {
  const microphone = settings.microphone && listening;
  if (microphone && settings.cameraGaze) return 'both';
  if (microphone) return 'microphone';
  if (settings.cameraGaze) return 'camera';
  return 'off';
}
