export interface StatusDevice {
  roomId: string;
  connectivity: string;
  capabilities: string[];
  metadata: { kind?: string | number | boolean | null };
  observed: Record<string, Record<string, unknown> | undefined>;
}

export interface RibbonItem {
  id: string;
  value: string;
  label: string;
}

export interface PlaceOption {
  id: 'sala' | 'recamara' | 'cocina' | 'oficina' | 'otro';
  match: string[];
}

export const places: PlaceOption[] = [
  { id: 'sala', match: ['living room', 'sala', 'sala principal'] },
  { id: 'recamara', match: ['bedroom', 'recamara', 'recámara'] },
  { id: 'cocina', match: ['kitchen', 'cocina'] },
  { id: 'oficina', match: ['office', 'oficina'] },
  { id: 'otro', match: [] },
];

export function groundUtterance(text: string, placeId: string, roomName: string | null): string {
  if (!roomName) return text;
  const place = places.find((item) => item.id === placeId);
  if (!place) return text;
  let next = text;
  const aliases = [...place.match].sort((a, b) => b.length - a.length);
  for (const alias of aliases) {
    if (alias.toLowerCase() === roomName.toLowerCase()) continue;
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    next = next.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), roomName);
  }
  return next;
}

export function greeting(hour: number, locale: 'en' | 'es'): string {
  if (locale === 'es') {
    if (hour < 12) return 'Buenos días.';
    if (hour < 19) return 'Buenas tardes.';
    return 'Buenas noches.';
  }
  if (hour < 12) return 'Good morning.';
  if (hour < 19) return 'Good afternoon.';
  return 'Good evening.';
}

export function matchRoom<T extends { id: string; name: string }>(rooms: T[], placeId: string, customName: string): T | null {
  const place = places.find((item) => item.id === placeId);
  const wanted = placeId === 'otro' ? [customName.trim().toLowerCase()] : (place?.match ?? []);
  return rooms.find((room) => wanted.includes(room.name.trim().toLowerCase())) ?? null;
}

export function ribbonFor(devices: StatusDevice[], roomId: string | null, labels: { interior: string; humidity: string; lights: string; climate: string }): RibbonItem[] {
  if (!roomId) return [];
  const here = devices.filter((device) => device.roomId === roomId);
  const items: RibbonItem[] = [];
  const climate = here.find((device) => typeof device.observed.temperature_sensor?.celsius === 'number' && !device.capabilities.includes('temperature_setpoint'));
  const thermostat = here.find((device) => typeof device.observed.temperature_sensor?.celsius === 'number' && device.capabilities.includes('temperature_setpoint'));
  const roomTemperature = climate?.observed.temperature_sensor?.celsius;
  const setpointTemperature = thermostat?.observed.temperature_sensor?.celsius;
  if (typeof roomTemperature === 'number') items.push({ id: 'temp', value: `${roomTemperature}°`, label: labels.interior });
  else if (typeof setpointTemperature === 'number') items.push({ id: 'climate', value: `${setpointTemperature}°`, label: labels.climate });
  const humidity = here.find((device) => typeof device.observed.humidity_sensor?.percent === 'number');
  const percent = humidity?.observed.humidity_sensor?.percent;
  if (typeof percent === 'number') items.push({ id: 'humidity', value: `${percent}%`, label: labels.humidity });
  const lights = here.filter((device) => device.metadata.kind === 'light' && device.capabilities.includes('on_off'));
  const on = lights.filter((device) => device.observed.on_off?.on === true).length;
  if (lights.length > 0) items.push({ id: 'lights', value: String(on), label: labels.lights });
  if (typeof roomTemperature === 'number' && typeof setpointTemperature === 'number') {
    items.push({ id: 'climate', value: `${setpointTemperature}°`, label: labels.climate });
  }
  return items;
}

export function comfort(devices: StatusDevice[], roomId: string | null): 'comfortable' | 'watch' | 'unknown' {
  if (!roomId) return 'unknown';
  const sensor = devices.find((device) => device.roomId === roomId && typeof device.observed.temperature_sensor?.celsius === 'number');
  const celsius = sensor?.observed.temperature_sensor?.celsius;
  if (typeof celsius !== 'number') return 'unknown';
  const humidity = devices.find((device) => device.roomId === roomId && typeof device.observed.humidity_sensor?.percent === 'number');
  const percent = humidity?.observed.humidity_sensor?.percent;
  const humidityOk = typeof percent !== 'number' || (percent >= 30 && percent <= 60);
  return celsius >= 20 && celsius <= 25 && humidityOk ? 'comfortable' : 'watch';
}
