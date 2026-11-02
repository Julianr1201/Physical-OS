import { describe, expect, it } from 'vitest';
import { forecastUrl, parseDeviceForecast, wallpaperScene, weatherKind } from './device-weather';

describe('device weather', () => {
  it('reads a daytime rain forecast and rejects a payload without a temperature', () => {
    expect(parseDeviceForecast({ current: { temperature_2m: 18.2, weather_code: 61, is_day: 1 } })).toEqual({
      celsius: 18.2,
      code: 61,
      day: true,
      kind: 'rain',
    });
    expect(parseDeviceForecast({ current: { weather_code: 0, is_day: 1 } })).toBeNull();
    expect(parseDeviceForecast({ current: { temperature_2m: 20, weather_code: 123, is_day: 0 } })).toBeNull();
  });

  it('keeps night clear distinct from an unread location', () => {
    expect(weatherKind(0)).toBe('clear');
    expect(weatherKind(95)).toBe('thunder');
    expect(weatherKind(4)).toBeNull();
    expect(wallpaperScene('clear', false)).toBe('clear-night');
    expect(wallpaperScene(null, true)).toBe('idle');
  });

  it('asks Open-Meteo for the rounded device coordinate and refuses a bad fix', () => {
    expect(forecastUrl(19.4326, -99.1332)).toBe(
      'https://api.open-meteo.com/v1/forecast?latitude=19.433&longitude=-99.133&current=temperature_2m%2Cweather_code%2Cis_day&timezone=auto',
    );
    expect(() => forecastUrl(120, 0)).toThrow(/outside/);
  });
});
