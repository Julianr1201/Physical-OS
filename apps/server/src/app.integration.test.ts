import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('control API', () => {
  it('enrolls an admin, controls a simulated light, and keeps unauthenticated calls out', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'physical-os-'));
    dirs.push(dataDir);
    const { app } = await buildApp({ dataDir, logger: false });
    const denied = await app.inject({ method: 'GET', url: '/api/v1/overview' });
    expect(denied.statusCode).toBe(401);

    const setup = await app.inject({
      method: 'POST',
      url: '/api/v1/setup',
      payload: { displayName: 'Ada', password: 'local-admin-pass' },
    });
    expect(setup.statusCode).toBe(201);
    const cookie = cookieOf(setup.headers['set-cookie']);
    const again = await app.inject({
      method: 'POST',
      url: '/api/v1/setup',
      payload: { displayName: 'Ada', password: 'local-admin-pass' },
    });
    expect(again.statusCode).toBe(409);

    const home = await app.inject({
      method: 'POST',
      url: '/api/v1/demo/simulated-home',
      headers: { cookie },
    });
    expect(home.statusCode).toBe(200);
    const created = home.json().data as { environmentId: string; overview: { devices: Array<{ id: string; name: string }> } };
    const ceiling = created.overview.devices.find((device) => device.name === 'Ceiling light');
    expect(ceiling).toBeTruthy();

    const pending = await app.inject({
      method: 'POST',
      url: `/api/v1/devices/${ceiling!.id}/commands`,
      headers: { cookie },
      payload: { capability: 'on_off', action: 'set', params: { on: true }, approval: 'none' },
    });
    expect(pending.statusCode).toBe(202);
    expect(pending.json().data.outcome).toBe('awaiting_approval');
    expect(pending.json().data.verified).toBe(false);

    const approved = await app.inject({
      method: 'POST',
      url: `/api/v1/commands/${pending.json().data.id}/approve`,
      headers: { cookie },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().data.verified).toBe(true);

    const sunset = await app.inject({
      method: 'POST',
      url: '/api/v1/signals',
      headers: { cookie },
      payload: { environmentId: created.environmentId, name: 'after_sunset', value: true },
    });
    expect(sunset.statusCode).toBe(200);
    const motion = created.overview.devices.find((device) => device.name === 'Motion sensor');
    await app.inject({
      method: 'POST',
      url: `/api/v1/devices/${motion!.id}/readings`,
      headers: { cookie },
      payload: { capability: 'motion_sensor', value: { detected: false } },
    });
    const triggered = await app.inject({
      method: 'POST',
      url: `/api/v1/devices/${motion!.id}/readings`,
      headers: { cookie },
      payload: { capability: 'motion_sensor', value: { detected: true } },
    });
    expect(triggered.statusCode).toBe(200);
    const overview = await app.inject({ method: 'GET', url: '/api/v1/overview', headers: { cookie } });
    const lamp = overview.json().data.devices.find((device: { name: string }) => device.name === 'Ceiling light');
    expect(lamp.observed.on_off).toEqual({ on: true });

    const plan = await app.inject({
      method: 'POST',
      url: '/api/v1/intelligence/interpret',
      headers: { cookie },
      payload: { environmentId: created.environmentId, utterance: 'Turn off all the living room lights.' },
    });
    expect(plan.statusCode).toBe(200);
    expect(plan.json().data.type).toBe('plan');
    const execution = await app.inject({
      method: 'POST',
      url: `/api/v1/intelligence/${plan.json().data.planId}/approve`,
      headers: { cookie },
    });
    expect(execution.statusCode).toBe(200);
    expect(execution.json().data.commands.every((command: { verified: boolean }) => command.verified)).toBe(true);

    const bad = await app.inject({
      method: 'POST',
      url: `/api/v1/devices/${ceiling!.id}/commands`,
      headers: { cookie },
      payload: { capability: 'on_off', action: 'exec', params: { cmd: 'reboot' } },
    });
    expect(bad.statusCode).toBe(422);

    const activity = await app.inject({ method: 'GET', url: '/api/v1/activity', headers: { cookie } });
    expect(activity.json().data.some((entry: { action: string }) => entry.action === 'intelligence.execute')).toBe(true);
    const health = await app.inject({ method: 'GET', url: '/api/v1/integrations', headers: { cookie } });
    expect(health.json().data.health.some((item: { adapterId: string; status: string }) => item.adapterId === 'android-tv' && item.status === 'planned')).toBe(true);

    await app.close();
  });

  it('starts a local demo without returning a password', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'physical-os-'));
    dirs.push(dataDir);
    const { app } = await buildApp({ dataDir, logger: false });
    const demo = await app.inject({ method: 'POST', url: '/api/v1/demo/session' });
    expect(demo.statusCode).toBe(201);
    expect(JSON.stringify(demo.json())).not.toMatch(/password/i);
    const cookie = cookieOf(demo.headers['set-cookie']);
    const again = await app.inject({ method: 'POST', url: '/api/v1/demo/session' });
    expect(again.statusCode).toBe(409);
    const home = await app.inject({ method: 'POST', url: '/api/v1/demo/simulated-home', headers: { cookie } });
    expect(home.statusCode).toBe(200);
    expect(home.json().data.simulated).toBe(true);
    await app.close();
  });

  it('sells a simulated product only after a verified payment', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'physical-os-'));
    dirs.push(dataDir);
    const { app } = await buildApp({ dataDir, logger: false });
    const setup = await app.inject({
      method: 'POST',
      url: '/api/v1/setup',
      payload: { displayName: 'Ada', password: 'local-admin-pass' },
    });
    const cookie = cookieOf(setup.headers['set-cookie']);
    const catalog = await app.inject({ method: 'GET', url: '/api/v1/commerce/catalog', headers: { cookie } });
    expect(catalog.statusCode).toBe(200);
    expect(catalog.json().data.simulated).toBe(true);
    expect(catalog.json().data.nfc.available).toBe(false);

    const checkout = await app.inject({
      method: 'POST',
      url: '/api/v1/commerce/checkout',
      headers: { cookie },
      payload: { lines: [{ sku: 'water', qty: 1 }], handoffOrigin: 'http://127.0.0.1:3000' },
    });
    expect(checkout.statusCode).toBe(200);
    expect(checkout.json().data.order.status).toBe('AWAITING_PAYMENT');
    expect(checkout.json().data.qrSvg).toContain('<svg');
    const orderId = checkout.json().data.order.id as string;

    const forged = await app.inject({
      method: 'POST',
      url: '/api/v1/commerce/payments/callback',
      headers: { cookie },
      payload: { body: JSON.stringify({ paid: true }), signature: 'a'.repeat(64) },
    });
    expect(forged.statusCode).toBe(403);

    const paid = await app.inject({
      method: 'POST',
      url: `/api/v1/commerce/orders/${orderId}/pay-simulation`,
      headers: { cookie },
    });
    expect(paid.statusCode).toBe(200);
    expect(paid.json().data.status).toBe('FULFILLED');
    expect(paid.json().data.dispenseVerified).toBe(true);

    const receipt = await app.inject({ method: 'GET', url: `/api/v1/commerce/orders/${orderId}/receipt`, headers: { cookie } });
    expect(receipt.json().data.simulated).toBe(true);
    expect(receipt.json().data.paymentVerified).toBe(true);
    const handoff = await app.inject({
      method: 'GET',
      url: `/api/v1/commerce/handoff/${orderId}?token=not-a-real-payment-token`,
    });
    expect(handoff.statusCode).toBe(401);
    await app.close();
  });
});

function cookieOf(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) throw new Error('Missing session cookie');
  return value.split(';')[0] ?? value;
}
