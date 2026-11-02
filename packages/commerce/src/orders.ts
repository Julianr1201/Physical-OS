export const orderStates = [
  'CREATED',
  'AWAITING_PAYMENT',
  'PAID',
  'FULFILLMENT_AUTHORIZED',
  'FULFILLING',
  'FULFILLED',
  'FAILED',
  'REFUND_PENDING',
  'REFUNDED',
] as const;

export type OrderState = (typeof orderStates)[number];

const allowed: Record<OrderState, readonly OrderState[]> = {
  CREATED: ['AWAITING_PAYMENT', 'FAILED'],
  AWAITING_PAYMENT: ['PAID', 'FAILED'],
  PAID: ['FULFILLMENT_AUTHORIZED', 'REFUND_PENDING'],
  FULFILLMENT_AUTHORIZED: ['FULFILLING'],
  FULFILLING: ['FULFILLED', 'FAILED', 'REFUND_PENDING'],
  FULFILLED: [],
  FAILED: ['REFUND_PENDING', 'FULFILLMENT_AUTHORIZED'],
  REFUND_PENDING: ['REFUNDED'],
  REFUNDED: [],
};

export function canTransition(from: OrderState, to: OrderState): boolean {
  return allowed[from].includes(to);
}
