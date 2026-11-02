export interface FulfillmentCommand {
  orderId: string;
  idempotencyKey: string;
  lines: Array<{ sku: string; qty: number }>;
  adapter: 'simulated-locker';
}

export interface FulfillmentResult {
  outcome: 'fulfilled' | 'failed' | 'uncertain';
  accepted: boolean;
  dispensed: boolean;
  verified: boolean;
  duplicate: boolean;
  evidence: string;
}

export interface FulfillmentAdapter {
  readonly id: 'simulated-locker';
  readonly simulated: true;
  execute(command: FulfillmentCommand): FulfillmentResult;
  inspect(idempotencyKey: string): FulfillmentResult | null;
}

export class SimulatedLocker implements FulfillmentAdapter {
  readonly id = 'simulated-locker' as const;
  readonly simulated = true as const;
  executions = 0;
  private mode: 'ok' | 'fail' | 'uncertain' = 'ok';
  private readonly issued = new Map<string, FulfillmentResult>();

  setMode(mode: 'ok' | 'fail' | 'uncertain'): void {
    this.mode = mode;
  }

  execute(command: FulfillmentCommand): FulfillmentResult {
    const previous = this.issued.get(command.idempotencyKey);
    if (previous) return { ...previous, duplicate: true };
    if (this.mode === 'fail') {
      return {
        outcome: 'failed',
        accepted: false,
        dispensed: false,
        verified: false,
        duplicate: false,
        evidence: 'dispenser_rejected',
      };
    }
    this.executions += 1;
    const result: FulfillmentResult =
      this.mode === 'uncertain'
        ? {
            outcome: 'uncertain',
            accepted: true,
            dispensed: false,
            verified: false,
            duplicate: false,
            evidence: 'command_accepted_unverified',
          }
        : {
            outcome: 'fulfilled',
            accepted: true,
            dispensed: true,
            verified: true,
            duplicate: false,
            evidence: 'simulated_slot_opened',
          };
    this.issued.set(command.idempotencyKey, result);
    return result;
  }

  inspect(idempotencyKey: string): FulfillmentResult | null {
    const found = this.issued.get(idempotencyKey);
    return found ? { ...found, duplicate: true } : null;
  }
}
