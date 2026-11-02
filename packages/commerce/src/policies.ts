import { CommerceError } from './errors.js';

/** Live card acquirers stay disabled. Simulation never stands in for a production charge. */
export function assertSimulation(mode: string): void {
  if (mode !== 'simulation') {
    throw new CommerceError('live_payments_disabled', 'Live payment providers are not enabled.', 403);
  }
}
