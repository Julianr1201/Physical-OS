'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { forecastUrl, parseDeviceForecast, type DeviceForecast } from '@/lib/device-weather';

export type DeviceWeather =
  | { status: 'locating'; retry: () => void }
  | { status: 'ready'; forecast: DeviceForecast; retry: () => void }
  | { status: 'denied'; retry: () => void }
  | { status: 'unavailable'; retry: () => void };

const DeviceWeatherContext = createContext<DeviceWeather | null>(null);

export function DeviceWeatherProvider({ children }: { children: ReactNode }) {
  const value = useDeviceWeatherState();
  return <DeviceWeatherContext.Provider value={value}>{children}</DeviceWeatherContext.Provider>;
}

export function useDeviceWeather(): DeviceWeather {
  const value = useContext(DeviceWeatherContext);
  if (!value) throw new Error('Weather missing');
  return value;
}

type WeatherReading =
  | { status: 'locating' }
  | { status: 'ready'; forecast: DeviceForecast }
  | { status: 'denied' }
  | { status: 'unavailable' };

function useDeviceWeatherState(): DeviceWeather {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<WeatherReading>({ status: 'locating' });
  const retry = () => setAttempt((current) => current + 1);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setState({ status: 'unavailable' });
      return;
    }
    let cancel = false;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        let url: string;
        try {
          url = forecastUrl(position.coords.latitude, position.coords.longitude);
        } catch {
          if (!cancel) setState({ status: 'unavailable' });
          return;
        }
        void fetch(url)
          .then((response) => {
            if (!response.ok) throw new Error('The forecast did not answer.');
            return response.json();
          })
          .then((payload: unknown) => {
            const forecast = parseDeviceForecast(payload);
            if (!cancel) setState(forecast ? { status: 'ready', forecast } : { status: 'unavailable' });
          })
          .catch(() => {
            if (!cancel) setState({ status: 'unavailable' });
          });
      },
      () => {
        if (!cancel) setState({ status: 'denied' });
      },
      { enableHighAccuracy: false, maximumAge: 600_000, timeout: 8_000 },
    );
    return () => {
      cancel = true;
    };
  }, [attempt]);

  if (state.status === 'ready') return { status: 'ready', forecast: state.forecast, retry };
  return { status: state.status, retry };
}
