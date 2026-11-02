import { describe, expect, it } from 'vitest';
import { CommerceService } from './service.js';

describe('simulated commerce', () => {
  it('checks out from the catalog, verifies a signed payment, and dispenses once', () => {
    const commerce = new CommerceService(() => new Date('2026-11-01T18:00:00.000Z'));
    const { order, payToken } = commerce.checkout([{ sku: 'water', qty: 2 }]);
    expect(order.totalCents).toBe(4000);
    expect(order.status).toBe('AWAITING_PAYMENT');
    expect(commerce.nfc().available).toBe(false);
    expect(commerce.tokenMatches(order.id, payToken)).toBe(true);

    const paid = commerce.simulatePayment(order.id);
    expect(paid.status).toBe('FULFILLED');
    expect(paid.paymentCaptured).toBe(true);
    expect(paid.dispenseVerified).toBe(true);
    expect(commerce.dispenserExecutions()).toBe(1);
    expect(commerce.simulatePayment(order.id).status).toBe('FULFILLED');
    expect(commerce.dispenserExecutions()).toBe(1);
    const receipt = commerce.receipt(order.id);
    expect(receipt.simulated).toBe(true);
    expect(receipt.paymentVerified).toBe(true);
    expect(receipt.totalCents).toBe(4000);
  });

  it('rejects an unsigned notice and a duplicate callback', () => {
    const commerce = new CommerceService(() => new Date('2026-11-01T18:00:00.000Z'));
    const { order } = commerce.checkout([{ sku: 'coffee', qty: 1 }]);
    expect(() => commerce.applyCallback(JSON.stringify({ paid: true, orderId: order.id }), 'deadbeef')).toThrow(/verified/i);
    const paid = commerce.simulatePayment(order.id);
    expect(paid.status).toBe('FULFILLED');
    expect(commerce.listCatalog().find((item) => item.sku === 'coffee')?.available).toBe(7);
  });

  it('expires an unpaid session and returns the stock', () => {
    let clock = Date.parse('2026-11-01T18:00:00.000Z');
    const commerce = new CommerceService(() => new Date(clock));
    const { order } = commerce.checkout([{ sku: 'snack', qty: 1 }]);
    clock += 4 * 60 * 1000;
    expect(commerce.getOrder(order.id).status).toBe('FAILED');
    expect(commerce.getOrder(order.id).failureReason).toBe('payment_expired');
    expect(commerce.listCatalog().find((item) => item.sku === 'snack')?.available).toBe(8);
  });

  it('refunds a paid order when the dispenser rejects it', () => {
    const commerce = new CommerceService();
    commerce.setDispenserMode('fail');
    const { order } = commerce.checkout([{ sku: 'water', qty: 1 }]);
    const failed = commerce.simulatePayment(order.id);
    expect(failed.status).toBe('FAILED');
    expect(failed.paymentCaptured).toBe(true);
    expect(failed.dispenseIssued).toBe(false);
    const refunded = commerce.refund(order.id);
    expect(refunded.status).toBe('REFUNDED');
    expect(commerce.receipt(order.id).state).toBe('REFUNDED');
    expect(commerce.listCatalog().find((item) => item.sku === 'water')?.available).toBe(8);
  });

  it('does not dispense again when delivery is uncertain', () => {
    const commerce = new CommerceService();
    commerce.setDispenserMode('uncertain');
    const { order } = commerce.checkout([{ sku: 'water', qty: 1 }]);
    const pending = commerce.simulatePayment(order.id);
    expect(pending.status).toBe('FULFILLING');
    expect(pending.dispenseIssued).toBe(true);
    expect(pending.dispenseVerified).toBe(false);
    expect(commerce.verifyFulfillment(order.id).status).toBe('FULFILLING');
    expect(commerce.dispenserExecutions()).toBe(1);
    expect(() => commerce.retryFulfillment(order.id)).toThrow(/cannot be repeated/i);
    const refunded = commerce.refund(order.id);
    expect(refunded.status).toBe('REFUNDED');
    expect(commerce.dispenserExecutions()).toBe(1);
  });

  it('starts payment once from a held order', () => {
    const commerce = new CommerceService(() => new Date('2026-11-01T18:00:00.000Z'));
    const held = commerce.holdOrder([{ sku: 'coffee', qty: 1 }]);
    expect(held.status).toBe('CREATED');
    expect(held.paymentCaptured).toBe(false);
    const first = commerce.openPayment(held.id);
    const second = commerce.openPayment(held.id);
    expect(first.order.status).toBe('AWAITING_PAYMENT');
    expect(second.session.id).toBe(first.session.id);
    expect(second.payToken).toBe('');
    expect(commerce.simulatePayment(held.id).dispenseVerified).toBe(true);
  });
});
