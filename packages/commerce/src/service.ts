import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { simulatedCatalog, type CatalogItem } from './catalog.js';
import { CommerceError } from './errors.js';
import { EventLog } from './events.js';
import { SimulatedLocker, type FulfillmentResult } from './fulfillment.js';
import { Inventory } from './inventory.js';
import { canTransition, type OrderState } from './orders.js';
import { SimulatedQrProvider, type PaymentConfirmation, type PaymentSession } from './payments.js';
import { priceLines, type PricedLine } from './pricing.js';
import { buildReceipt, type DigitalReceipt } from './receipts.js';

export interface CustomerOrder {
  id: string;
  status: OrderState;
  lines: PricedLine[];
  totalCents: number;
  currency: 'MXN';
  simulated: true;
  paymentCaptured: boolean;
  dispenseIssued: boolean;
  dispenseVerified: boolean;
  failureReason: string | null;
  reservationIds: string[];
  paymentSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

const SESSION_MS = 3 * 60 * 1000;

export class CommerceService {
  readonly catalog: CatalogItem[];
  private readonly inventory: Inventory;
  private readonly provider: SimulatedQrProvider;
  private readonly locker: SimulatedLocker;
  private readonly events = new EventLog();
  private readonly orders = new Map<string, CustomerOrder>();
  private readonly sessions = new Map<string, PaymentSession>();
  private readonly tokens = new Map<string, string>();
  private readonly seenEvents = new Set<string>();

  constructor(
    private readonly now: () => Date = () => new Date(),
    secret = randomBytes(32).toString('hex'),
  ) {
    this.catalog = simulatedCatalog();
    this.inventory = new Inventory(this.catalog.map((item) => ({ sku: item.sku, qty: 8 })));
    this.provider = new SimulatedQrProvider(secret);
    this.locker = new SimulatedLocker();
  }

  listCatalog(): Array<CatalogItem & { available: number }> {
    return this.catalog.map((item) => ({ ...item, available: this.inventory.available(item.sku) }));
  }

  nfc() {
    return this.provider.nfcStatus();
  }

  checkout(lines: Array<{ sku: string; qty: number }>): { order: CustomerOrder; session: PaymentSession; payToken: string } {
    const priced = priceLines(this.catalog, lines);
    const reservations = priced.items.map((item) => this.inventory.reserve(item.sku, item.qty));
    const created = this.order(priced.items, priced.totalCents, reservations.map((item) => item.id));
    this.move(created, 'AWAITING_PAYMENT');
    const session: PaymentSession = {
      id: randomUUID(),
      orderId: created.id,
      amountCents: created.totalCents,
      currency: 'MXN',
      expiresAt: new Date(this.now().getTime() + SESSION_MS).toISOString(),
      mode: 'simulation',
      method: 'dynamic_qr',
      nfc: this.provider.nfcStatus(),
    };
    const payToken = randomBytes(32).toString('base64url');
    this.sessions.set(session.id, session);
    this.tokens.set(created.id, createHash('sha256').update(payToken).digest('hex'));
    created.paymentSessionId = session.id;
    this.note(created, 'payment.session', 'simulation_qr');
    return { order: this.view(created), session, payToken };
  }

  getOrder(orderId: string): CustomerOrder {
    return this.view(this.expire(this.require(orderId)));
  }

  tokenMatches(orderId: string, token: string): boolean {
    const stored = this.tokens.get(orderId);
    if (!stored) return false;
    const given = createHash('sha256').update(token).digest('hex');
    const left = Buffer.from(stored);
    const right = Buffer.from(given);
    return left.length === right.length && timingSafeEqual(left, right);
  }

  cancel(orderId: string): CustomerOrder {
    const order = this.expire(this.require(orderId));
    if (order.status !== 'AWAITING_PAYMENT' && order.status !== 'CREATED') {
      throw new CommerceError('not_cancelable', 'This order can no longer be cancelled.', 409);
    }
    this.release(order);
    this.move(order, 'FAILED', 'cancelled');
    return this.view(order);
  }

  simulatePayment(orderId: string): CustomerOrder {
    const order = this.expire(this.require(orderId));
    if (order.status !== 'AWAITING_PAYMENT' || !order.paymentSessionId) return this.view(order);
    const confirmation: PaymentConfirmation = {
      providerEventId: randomUUID(),
      sessionId: order.paymentSessionId,
      orderId: order.id,
      status: 'paid',
      amountCents: order.totalCents,
      currency: 'MXN',
      mode: 'simulation',
    };
    const signed = this.provider.sign(confirmation);
    return this.applyCallback(signed.body, signed.signature);
  }

  applyCallback(body: string, signature: string): CustomerOrder {
    const confirmation = this.provider.verify(body, signature);
    const order = this.expire(this.require(confirmation.orderId));
    const session = this.sessions.get(confirmation.sessionId);
    if (!session || session.orderId !== order.id || confirmation.amountCents !== order.totalCents) {
      throw new CommerceError('payment_mismatch', 'The payment notice does not match the order.', 409);
    }
    if (this.seenEvents.has(confirmation.providerEventId)) return this.view(order);
    this.seenEvents.add(confirmation.providerEventId);
    if (confirmation.status === 'refunded') return this.finishRefund(order);
    if (order.paymentCaptured || order.status !== 'AWAITING_PAYMENT') {
      this.note(order, 'payment.duplicate', confirmation.providerEventId);
      return this.view(order);
    }
    if (Date.parse(session.expiresAt) < this.now().getTime()) {
      throw new CommerceError('payment_expired', 'The payment session expired.', 409);
    }
    this.move(order, 'PAID');
    order.paymentCaptured = true;
    this.note(order, 'payment.verified', confirmation.providerEventId);
    return this.view(this.fulfill(order));
  }

  retryFulfillment(orderId: string): CustomerOrder {
    const order = this.require(orderId);
    if (!order.paymentCaptured || order.dispenseIssued || order.status !== 'FAILED') {
      throw new CommerceError('retry_blocked', 'Delivery cannot be repeated for this order.', 409);
    }
    return this.view(this.fulfill(order));
  }

  verifyFulfillment(orderId: string): CustomerOrder {
    const order = this.require(orderId);
    if (!order.dispenseIssued) throw new CommerceError('nothing_to_verify', 'No delivery command was sent.', 409);
    const found = this.locker.inspect(order.id);
    if (!found) return this.view(order);
    return this.view(this.applyFulfillment(order, found));
  }

  refund(orderId: string): CustomerOrder {
    const order = this.require(orderId);
    if (!order.paymentCaptured || order.status === 'FULFILLED' || order.status === 'REFUNDED' || order.dispenseVerified) {
      throw new CommerceError('refund_blocked', 'This order cannot be refunded.', 409);
    }
    if (order.status !== 'REFUND_PENDING') this.move(order, 'REFUND_PENDING');
    const confirmation: PaymentConfirmation = {
      providerEventId: randomUUID(),
      sessionId: order.paymentSessionId ?? order.id,
      orderId: order.id,
      status: 'refunded',
      amountCents: order.totalCents,
      currency: 'MXN',
      mode: 'simulation',
    };
    const signed = this.provider.sign(confirmation);
    return this.applyCallback(signed.body, signed.signature);
  }

  receipt(orderId: string): DigitalReceipt {
    const order = this.require(orderId);
    if (order.status !== 'FULFILLED' && order.status !== 'REFUNDED') {
      throw new CommerceError('receipt_not_ready', 'The receipt is available after a verified outcome.', 409);
    }
    return buildReceipt({
      orderId: order.id,
      issuedAt: order.updatedAt,
      currency: 'MXN',
      totalCents: order.totalCents,
      lines: order.lines.map((line) => ({ sku: line.sku, qty: line.qty, lineCents: line.lineCents })),
      state: order.status,
      paymentVerified: order.paymentCaptured,
      fulfillmentVerified: order.dispenseVerified,
    });
  }

  setDispenserMode(mode: 'ok' | 'fail' | 'uncertain'): void {
    this.locker.setMode(mode);
  }

  dispenserExecutions(): number {
    return this.locker.executions;
  }

  private fulfill(order: CustomerOrder): CustomerOrder {
    if (order.status === 'FAILED') this.move(order, 'FULFILLMENT_AUTHORIZED');
    else this.move(order, 'FULFILLMENT_AUTHORIZED');
    this.move(order, 'FULFILLING');
    const result = this.locker.execute({
      orderId: order.id,
      idempotencyKey: order.id,
      lines: order.lines.map((line) => ({ sku: line.sku, qty: line.qty })),
      adapter: 'simulated-locker',
    });
    return this.applyFulfillment(order, result);
  }

  private applyFulfillment(order: CustomerOrder, result: FulfillmentResult): CustomerOrder {
    if (result.accepted) order.dispenseIssued = true;
    this.note(order, 'fulfillment.result', result.evidence);
    if (result.outcome === 'fulfilled' && result.verified) {
      for (const id of order.reservationIds) this.inventory.commit(id);
      order.dispenseVerified = true;
      this.move(order, 'FULFILLED');
      return order;
    }
    if (result.outcome === 'uncertain') return order;
    this.release(order);
    this.move(order, 'FAILED', 'fulfillment_failed');
    return order;
  }

  private finishRefund(order: CustomerOrder): CustomerOrder {
    if (order.status === 'REFUNDED') return order;
    if (order.status !== 'REFUND_PENDING') {
      throw new CommerceError('refund_blocked', 'This order cannot be refunded.', 409);
    }
    this.release(order);
    order.paymentCaptured = false;
    this.move(order, 'REFUNDED');
    this.note(order, 'payment.refunded', 'simulation');
    return order;
  }

  private expire(order: CustomerOrder): CustomerOrder {
    if (order.status !== 'AWAITING_PAYMENT' || !order.paymentSessionId) return order;
    const session = this.sessions.get(order.paymentSessionId);
    if (!session || Date.parse(session.expiresAt) >= this.now().getTime()) return order;
    this.release(order);
    this.move(order, 'FAILED', 'payment_expired');
    return order;
  }

  private release(order: CustomerOrder): void {
    if (order.dispenseVerified) return;
    for (const id of order.reservationIds) this.inventory.release(id);
  }

  private order(lines: PricedLine[], totalCents: number, reservationIds: string[]): CustomerOrder {
    const at = this.now().toISOString();
    const order: CustomerOrder = {
      id: randomUUID(),
      status: 'CREATED',
      lines,
      totalCents,
      currency: 'MXN',
      simulated: true,
      paymentCaptured: false,
      dispenseIssued: false,
      dispenseVerified: false,
      failureReason: null,
      reservationIds,
      paymentSessionId: null,
      createdAt: at,
      updatedAt: at,
    };
    this.orders.set(order.id, order);
    this.note(order, 'order.created', 'simulation');
    return order;
  }

  private move(order: CustomerOrder, to: OrderState, reason?: string): void {
    if (!canTransition(order.status, to)) {
      throw new CommerceError('invalid_transition', `Cannot move from ${order.status} to ${to}.`, 409);
    }
    order.status = to;
    order.updatedAt = this.now().toISOString();
    if (reason) order.failureReason = reason;
    this.note(order, 'order.state', to);
  }

  private note(order: CustomerOrder, type: string, detail: string): void {
    this.events.add({ id: randomUUID(), at: this.now().toISOString(), orderId: order.id, type, detail });
  }

  private require(orderId: string): CustomerOrder {
    const order = this.orders.get(orderId);
    if (!order) throw new CommerceError('unknown_order', 'Order not found.', 404);
    return order;
  }

  private view(order: CustomerOrder): CustomerOrder {
    return {
      ...order,
      lines: order.lines.map((line) => ({ ...line, name: { ...line.name } })),
    };
  }
}
