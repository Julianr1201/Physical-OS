import type { OrderState } from './orders.js';

export interface DigitalReceipt {
  orderId: string;
  issuedAt: string;
  currency: 'MXN';
  totalCents: number;
  lines: Array<{ sku: string; qty: number; lineCents: number }>;
  state: OrderState;
  simulated: true;
  paymentVerified: boolean;
  fulfillmentVerified: boolean;
}

export function buildReceipt(input: Omit<DigitalReceipt, 'simulated'>): DigitalReceipt {
  return { ...input, simulated: true };
}
