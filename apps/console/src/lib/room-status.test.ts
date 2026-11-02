import { describe, expect, it } from 'vitest';
import { comfort, greeting, groundUtterance, matchRoom, ribbonFor, type StatusDevice } from './room-status';

const labels = { interior: 'Interior', humidity: 'Humidity', lights: 'Lights on', climate: 'Climate' };

function device(patch: Partial<StatusDevice> & Pick<StatusDevice, 'roomId'>): StatusDevice {
  return {
    connectivity: 'online',
    capabilities: [],
    metadata: {},
    observed: {},
    ...patch,
  };
}

describe('room status', () => {
  it('greets from the hour without inventing a place', () => {
    expect(greeting(21, 'es')).toBe('Buenas noches.');
    expect(greeting(9, 'en')).toBe('Good morning.');
  });

  it('matches the television room and hides metrics that were not observed', () => {
    const rooms = [
      { id: 'living', name: 'Living Room' },
      { id: 'kitchen', name: 'Kitchen' },
    ];
    expect(matchRoom(rooms, 'sala', '')?.id).toBe('living');
    expect(matchRoom(rooms, 'oficina', '')).toBeNull();
    const devices = [
      device({
        roomId: 'living',
        capabilities: ['temperature_sensor', 'humidity_sensor'],
        metadata: { kind: 'environment_sensor' },
        observed: { temperature_sensor: { celsius: 22 }, humidity_sensor: { percent: 46 } },
      }),
      device({
        roomId: 'living',
        capabilities: ['on_off'],
        metadata: { kind: 'light' },
        observed: { on_off: { on: true } },
      }),
    ];
    expect(ribbonFor(devices, 'living', labels).map((item) => item.id)).toEqual(['temp', 'humidity', 'lights']);
    expect(ribbonFor(devices, null, labels)).toEqual([]);
    expect(comfort(devices, 'living')).toBe('comfortable');
    expect(comfort(devices, 'kitchen')).toBe('unknown');
    expect(groundUtterance('Apaga todas las luces de la sala', 'sala', 'Living Room')).toBe(
      'Apaga todas las luces de la Living Room',
    );
  });
});
