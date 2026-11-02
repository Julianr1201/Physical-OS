import { createHmac, timingSafeEqual } from 'node:crypto';
import { CommerceError } from './errors.js';
import { assertSimulation } from './policies.js';

export interface PaymentSession {
  id: string;
  orderId: string;
  amountCents: number;
  currency: 'MXN';
  expiresAt: string;
  mode: 'simulation';
  method: 'dynamic_qr';
  nfc: { available: false; reason: string };
}

export interface PaymentConfirmation {
  providerEventId: string;
  sessionId: string;
  orderId: string;
  status: 'paid' | 'refunded';
  amountCents: number;
  currency: 'MXN';
  mode: 'simulation';
}

export interface PaymentProvider {
  readonly id: string;
  readonly mode: 'simulation';
  readonly methods: Array<'dynamic_qr' | 'nfc'>;
  sign(confirmation: PaymentConfirmation): { body: string; signature: string };
  verify(body: string, signature: string): PaymentConfirmation;
}

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export class SimulatedQrProvider implements PaymentProvider {
  readonly id = 'simulated-qr';
  readonly mode = 'simulation' as const;
  readonly methods = ['dynamic_qr'] as Array<'dynamic_qr' | 'nfc'>;

  constructor(private readonly secret: string) {
    assertSimulation(this.mode);
  }

  sign(confirmation: PaymentConfirmation): { body: string; signature: string } {
    assertSimulation(confirmation.mode);
    const body = stableJson(confirmation);
    return { body, signature: createHmac('sha256', this.secret).update(body).digest('hex') };
  }

  verify(body: string, signature: string): PaymentConfirmation {
    const expected = createHmac('sha256', this.secret).update(body).digest('hex');
    const left = Buffer.from(expected);
    const right = Buffer.from(signature);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new CommerceError('invalid_signature', 'The payment notice could not be verified.', 403);
    }
    const parsed = JSON.parse(body) as PaymentConfirmation;
    assertSimulation(parsed.mode);
    if (!parsed.providerEventId || !parsed.sessionId || !parsed.orderId) {
      throw new CommerceError('invalid_notice', 'The payment notice is incomplete.', 422);
    }
    if (parsed.status !== 'paid' && parsed.status !== 'refunded') {
      throw new CommerceError('invalid_notice', 'The payment notice is incomplete.', 422);
    }
    return parsed;
  }

  nfcStatus(): { available: false; reason: string } {
    return {
      available: false,
      reason: 'No certified contactless terminal is connected. A generic NFC reader cannot take card payments.',
    };
  }
}
