export type WeatherKind = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'thunder';

const weatherLabels = {
  en: {
    clear: 'Clear',
    cloudy: 'Cloudy',
    fog: 'Fog',
    rain: 'Rain',
    snow: 'Snow',
    thunder: 'Storm',
    outside: 'Outside',
    locating: 'Locating this device…',
    denied: 'Location is off.',
    unavailable: 'Weather is unavailable.',
    retry: 'Use this device’s location',
  },
  es: {
    clear: 'Despejado',
    cloudy: 'Nublado',
    fog: 'Niebla',
    rain: 'Lluvia',
    snow: 'Nieve',
    thunder: 'Tormenta',
    outside: 'Afuera',
    locating: 'Ubicando este dispositivo…',
    denied: 'La ubicación está apagada.',
    unavailable: 'El clima no está disponible.',
    retry: 'Usar la ubicación de este dispositivo',
  },
} as const;

export function weatherCopy(locale: 'en' | 'es') {
  return weatherLabels[locale];
}

export interface DeviceForecast {
  celsius: number;
  code: number;
  day: boolean;
  kind: WeatherKind;
}

/** Maps a WMO weather code. Unknown codes are rejected instead of labeled as clear. */
export function weatherKind(code: number): WeatherKind | null {
  if (!Number.isInteger(code) || code < 0) return null;
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95 && code <= 99) return 'thunder';
  return null;
}

export function wallpaperScene(kind: WeatherKind | null, day: boolean): string {
  if (kind === 'clear') return day ? 'clear-day' : 'clear-night';
  if (kind === 'cloudy' || kind === 'fog') return day ? 'cloud' : 'cloud-night';
  if (kind === 'rain') return 'rain';
  if (kind === 'snow') return 'snow';
  if (kind === 'thunder') return 'thunder';
  return 'idle';
}

export function parseDeviceForecast(payload: unknown): DeviceForecast | null {
  if (!payload || typeof payload !== 'object') return null;
  const current = (payload as { current?: unknown }).current;
  if (!current || typeof current !== 'object') return null;
  const record = current as Record<string, unknown>;
  if (typeof record.temperature_2m !== 'number' || !Number.isFinite(record.temperature_2m)) return null;
  if (typeof record.weather_code !== 'number') return null;
  const kind = weatherKind(record.weather_code);
  if (!kind) return null;
  if (record.is_day !== 0 && record.is_day !== 1) return null;
  return {
    celsius: record.temperature_2m,
    code: record.weather_code,
    day: record.is_day === 1,
    kind,
  };
}

/** Three decimals is about one hundred meters, enough for a forecast and coarser than a street fix. */
export function forecastUrl(latitude: number, longitude: number): string {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('The device location is not a coordinate.');
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new Error('The device location is outside the forecast grid.');
  const params = new URLSearchParams({
    latitude: latitude.toFixed(3),
    longitude: longitude.toFixed(3),
    current: 'temperature_2m,weather_code,is_day',
    timezone: 'auto',
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}
