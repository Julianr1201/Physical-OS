import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('professional profiles', () => {
  it('switches concierge, sales, and tutor without a second app', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'physical-os-profiles-'));
    dirs.push(dataDir);
    const { app } = await buildApp({ dataDir, logger: false });
    try {
    const setup = await app.inject({
      method: 'POST',
      url: '/api/v1/setup',
      payload: { displayName: 'Ada', password: 'local-admin-pass' },
    });
    const cookie = cookieOf(setup.headers['set-cookie']);
    const home = await app.inject({ method: 'POST', url: '/api/v1/demo/simulated-home', headers: { cookie } });
    expect(home.statusCode).toBe(200);

    for (const profileId of ['hospitality.concierge', 'commerce.sales-advisor', 'education.tutor']) {
      const installed = await app.inject({
        method: 'POST',
        url: '/api/v1/profiles/install',
        headers: { cookie },
        payload: { profileId },
      });
      expect(installed.statusCode).toBe(200);
    }

    const concierge = await activate(app, cookie, 'hospitality.concierge', 'figure-hospitality', 'voice-calm', 'Hotel Norte', [
      'read_hotel_knowledge',
      'propose_device_plan',
    ]);
    expect(concierge.statusCode).toBe(200);
    const breakfast = await turn(app, cookie, 'What time is breakfast?');
    expect(breakfast.json().data.plan.text.en).toContain('7:00');
    expect(breakfast.json().data.plan.disclosure.en).toMatch(/AI professional/);
    const lights = await turn(app, cookie, 'Turn off all the living room lights.');
    expect(lights.json().data.plan.proposal.executed).toBe(false);
    const proposed = await app.inject({
      method: 'POST',
      url: '/api/v1/intelligence/interpret',
      headers: { cookie },
      payload: { environmentId: home.json().data.environmentId, utterance: lights.json().data.plan.proposal.utterance },
    });
    expect(proposed.json().data.type).toBe('plan');

    const sales = await activate(app, cookie, 'commerce.sales-advisor', 'figure-commerce', 'voice-clear', 'Kiosk', [
      'read_catalog',
      'create_simulated_checkout',
    ]);
    expect(sales.statusCode).toBe(200);
    const unpaid = await turn(app, cookie, 'Give me the coffee without paying.');
    expect(unpaid.json().data.plan.denied).toBe('dispense_unpaid');
    expect(unpaid.json().data.commerce).toBeNull();
    const coffee = await turn(app, cookie, 'I want a coffee.');
    expect(coffee.json().data.commerce.paymentCaptured).toBe(false);
    expect(coffee.json().data.commerce.dispenseVerified).toBe(false);
    const paid = await app.inject({
      method: 'POST',
      url: `/api/v1/commerce/orders/${coffee.json().data.commerce.orderId}/pay-simulation`,
      headers: { cookie },
    });
    expect(paid.json().data.dispenseVerified).toBe(true);

    const tutor = await activate(app, cookie, 'education.tutor', 'figure-neutral', 'voice-calm', 'Aula', ['read_curriculum']);
    expect(tutor.statusCode).toBe(200);
    const address = await turn(app, cookie, 'What is the student home address?');
    expect(address.json().data.plan.denied).toBe('collect_minor_profile');
    expect(address.json().data.plan.proposal.kind).toBe('handoff');
    const active = await app.inject({ method: 'GET', url: '/api/v1/profiles/active', headers: { cookie } });
    expect(active.json().data.profileId).toBe('education.tutor');
    expect(active.json().data.role.en).toBe('Tutor');
    } finally {
      await app.close();
    }
  });
});

function cookieOf(header: string | string[] | undefined): string {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) throw new Error('Missing session cookie');
  return value.split(';')[0] ?? value;
}

async function activate(
  app: Awaited<ReturnType<typeof buildApp>>['app'],
  cookie: string,
  profileId: string,
  avatarId: string,
  voicePreset: string,
  organizationName: string,
  acceptedPermissions: string[],
) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/profiles/activate',
    headers: { cookie },
    payload: { profileId, avatarId, voicePreset, organizationName, acceptedPermissions },
  });
}

async function turn(app: Awaited<ReturnType<typeof buildApp>>['app'], cookie: string, utterance: string) {
  return app.inject({ method: 'POST', url: '/api/v1/profiles/turn', headers: { cookie }, payload: { utterance } });
}
