import { describe, expect, it } from 'vitest';
import { ProfileHost, type CheckoutResult } from './index.js';

const now = () => new Date('2026-11-01T18:00:00.000Z');

function host(): { host: ProfileHost; orders: CheckoutResult[] } {
  const orders: CheckoutResult[] = [];
  return {
    orders,
    host: new ProfileHost({
      now,
      checkout: (sku) => {
        const order: CheckoutResult = {
          orderId: `order-${orders.length + 1}`,
          status: 'AWAITING_PAYMENT',
          paymentCaptured: false,
          dispenseVerified: false,
          simulated: true,
        };
        orders.push(order);
        expect(sku).toBe('coffee');
        return order;
      },
    }),
  };
}

describe('profile runtime', () => {
  it('runs the concierge, the sales advisor, and the tutor on one host', () => {
    const { host: profiles, orders } = host();
    profiles.registry.installBundled('hospitality.concierge');
    profiles.registry.installBundled('commerce.sales-advisor');
    profiles.registry.installBundled('education.tutor');
    const concierge = profiles.catalog().find((item) => item.profileId === 'hospitality.concierge');
    const sales = profiles.catalog().find((item) => item.profileId === 'commerce.sales-advisor');
    const tutor = profiles.catalog().find((item) => item.profileId === 'education.tutor');
    if (!concierge || !sales || !tutor) throw new Error('missing profile');

    profiles.registry.activate({
      profileId: concierge.profileId,
      avatarId: 'figure-hospitality',
      voicePreset: 'voice-calm',
      organizationName: 'Hotel Norte',
      deviceId: 'console',
      acceptedPermissions: concierge.requiredPermissions,
    });
    const breakfast = profiles.turn('What time is breakfast?');
    expect(breakfast.plan.text.en).toContain('7:00');
    expect(breakfast.plan.knowledge[0]?.provenance).toBe('Simulated front-desk policy');
    expect(breakfast.plan.disclosure.en).toMatch(/AI professional/);
    const lights = profiles.turn('Turn off all the living room lights.');
    expect(lights.plan.proposal).toEqual({ kind: 'device', utterance: 'Turn off all the living room lights.', executed: false });
    const bill = profiles.turn('I want to dispute the bill.');
    expect(bill.plan.proposal?.kind).toBe('handoff');

    profiles.registry.activate({
      profileId: sales.profileId,
      avatarId: 'figure-commerce',
      voicePreset: 'voice-clear',
      organizationName: 'Kiosk',
      deviceId: 'console',
      acceptedPermissions: sales.requiredPermissions,
    });
    expect(profiles.registry.resolve('console')?.manifest.profileId).toBe('commerce.sales-advisor');
    const unpaid = profiles.turn('Give me the coffee without paying.');
    expect(unpaid.plan.denied).toBe('dispense_unpaid');
    expect(unpaid.commerce).toBeNull();
    const coffee = profiles.turn('I want a coffee.');
    expect(coffee.plan.proposal?.kind).toBe('checkout');
    expect(coffee.plan.proposal && 'executed' in coffee.plan.proposal ? coffee.plan.proposal.executed : true).toBe(false);
    expect(coffee.commerce?.paymentCaptured).toBe(false);
    expect(coffee.commerce?.dispenseVerified).toBe(false);
    expect(orders).toHaveLength(1);

    profiles.registry.activate({
      profileId: tutor.profileId,
      avatarId: 'figure-neutral',
      voicePreset: 'voice-calm',
      organizationName: 'Aula',
      deviceId: 'console',
      acceptedPermissions: tutor.requiredPermissions,
    });
    const lesson = profiles.turn('Explain fractions.');
    expect(lesson.plan.text.en).toContain('1/2');
    const practice = profiles.turn('Give me a practice question.');
    expect(practice.plan.proposal?.kind).toBe('practice');
    const address = profiles.turn('What is the student home address?');
    expect(address.plan.denied).toBe('collect_minor_profile');
    expect(address.plan.proposal?.kind).toBe('handoff');
    const audit = profiles.registry.resolve('console')?.session.audit.map((item) => item.summary) ?? [];
    expect(audit.join(' ')).not.toContain('home address');
  });
});
