import { retrieveKnowledge } from '@physical-os/knowledge-connectors';
import { starterProfiles, type ProfileManifest } from '@physical-os/professional-profiles';
import { ProfileError, ProfileRegistry, type ProfileSession } from '@physical-os/profile-registry';
import { planTurn, type ProfilePlan } from './plan.js';

export const profileDeviceId = 'console';

export const purchaseStages = [
  'interpreted',
  'proposed',
  'confirmed',
  'order_created',
  'payment_started',
  'payment_verified',
  'fulfillment_authorized',
  'delivery_verified',
  'cancelled',
  'interrupted',
] as const;

export type PurchaseStage = (typeof purchaseStages)[number];

export interface CheckoutResult {
  orderId: string;
  status: string;
  paymentCaptured: boolean;
  dispenseVerified: boolean;
  simulated: true;
  stage: PurchaseStage;
}

export interface PurchasePort {
  createOrder(sku: string, qty: number): CheckoutResult;
  startPayment(orderId: string): CheckoutResult;
  cancelOrder(orderId: string): CheckoutResult;
}

export interface PurchaseOperation {
  stage: PurchaseStage;
  proposalId: string | null;
  orderId: string | null;
}

export interface TurnResult {
  plan: ProfilePlan;
  commerce: CheckoutResult | null;
  operation: PurchaseOperation | null;
  metrics: ProfileSession['metrics'] | null;
}

interface PendingPurchase {
  proposalId: string;
  sku: 'water' | 'coffee' | 'snack';
  qty: 1;
  stage: PurchaseStage;
  orderId: string | null;
  commerce: CheckoutResult | null;
}

export class ProfileHost {
  readonly registry: ProfileRegistry;
  private readonly pending = new Map<string, PendingPurchase>();
  private proposalCount = 0;

  constructor(
    private readonly options: {
      mode?: 'simulation' | 'production';
      trustKey?: string;
      now?: () => Date;
      purchase?: PurchasePort;
    } = {},
  ) {
    this.registry = new ProfileRegistry({
      mode: options.mode ?? 'simulation',
      trustKey: options.trustKey ?? 'simulation-only',
      now: options.now,
    });
  }

  catalog(): ProfileManifest[] {
    return starterProfiles();
  }

  preview(profileId: string, utterance: string): ProfilePlan {
    const installed = this.registry.listInstalled().find((item) => item.manifest.profileId === profileId);
    if (!installed) throw new ProfileError('not_installed', 'That profile is not installed.', 404);
    const now = this.options.now?.() ?? new Date();
    const knowledge = retrieveKnowledge(installed.manifest.knowledgeSources, utterance, now);
    return planTurn(installed.manifest, installed.manifest.presencePreset, installed.manifest.voicePreset, utterance, knowledge);
  }

  turn(utterance: string): TurnResult {
    const active = this.registry.resolve(profileDeviceId);
    if (!active) throw new ProfileError('no_active_profile', 'Activate a profile first.', 409);
    const control = controlWord(utterance);
    if (control === 'confirm') return this.confirm();
    if (control === 'cancel' && this.pending.has(active.session.id)) return this.cancel();
    this.interruptProposal(active.session);
    const result = this.answer(active.manifest, active.deployment.avatarId, active.deployment.voicePreset, utterance);
    return this.finish(active.session, result);
  }

  confirm(): TurnResult {
    const active = this.registry.resolve(profileDeviceId);
    if (!active) throw new ProfileError('no_active_profile', 'Activate a profile first.', 409);
    const pending = this.pending.get(active.session.id);
    if (!pending || (pending.stage !== 'proposed' && pending.stage !== 'payment_started')) {
      throw new ProfileError('nothing_to_confirm', 'There is no checkout to confirm.', 409);
    }
    if (!this.options.purchase) throw new ProfileError('commerce_unavailable', 'Simulated checkout is not connected.', 503);
    if (pending.stage === 'payment_started' && pending.orderId && pending.commerce) {
      const same = this.options.purchase.startPayment(pending.orderId);
      pending.commerce = { ...same, stage: 'payment_started' };
      const plan = this.purchasePlan(active.manifest, active.deployment.avatarId, active.deployment.voicePreset, pending, 'already');
      return this.finish(active.session, { plan, commerce: pending.commerce, operation: operationOf(pending), metrics: null });
    }
    pending.stage = 'confirmed';
    const created = this.options.purchase.createOrder(pending.sku, pending.qty);
    pending.stage = 'order_created';
    pending.orderId = created.orderId;
    const started = this.options.purchase.startPayment(created.orderId);
    pending.stage = 'payment_started';
    pending.commerce = { ...started, stage: 'payment_started' };
    active.session.metrics.checkouts += 1;
    const plan = this.purchasePlan(active.manifest, active.deployment.avatarId, active.deployment.voicePreset, pending, 'started');
    return this.finish(active.session, { plan, commerce: pending.commerce, operation: operationOf(pending), metrics: null });
  }

  cancel(): TurnResult {
    const active = this.registry.resolve(profileDeviceId);
    if (!active) throw new ProfileError('no_active_profile', 'Activate a profile first.', 409);
    const pending = this.pending.get(active.session.id);
    if (!pending || pending.stage === 'cancelled' || pending.stage === 'interrupted') {
      throw new ProfileError('nothing_to_cancel', 'There is no checkout to cancel.', 409);
    }
    if (pending.orderId && this.options.purchase && pending.stage !== 'proposed') {
      pending.commerce = { ...this.options.purchase.cancelOrder(pending.orderId), stage: 'cancelled' };
    }
    pending.stage = 'cancelled';
    pending.commerce = pending.commerce ? { ...pending.commerce, stage: 'cancelled' } : null;
    const plan = this.purchasePlan(active.manifest, active.deployment.avatarId, active.deployment.voicePreset, pending, 'cancelled');
    this.pending.delete(active.session.id);
    return this.finish(active.session, { plan, commerce: pending.commerce, operation: operationOf(pending), metrics: null });
  }

  private interruptProposal(session: ProfileSession): void {
    const pending = this.pending.get(session.id);
    if (pending?.stage !== 'proposed') return;
    pending.stage = 'interrupted';
    this.pending.delete(session.id);
    this.registry.audit(session, 'purchase', 'interrupted');
  }

  private answer(manifest: ProfileManifest, avatarId: string, voicePreset: string, utterance: string): TurnResult {
    const now = this.options.now?.() ?? new Date();
    const knowledge = retrieveKnowledge(manifest.knowledgeSources, utterance, now);
    const plan = planTurn(manifest, avatarId, voicePreset, utterance, knowledge);
    if (plan.proposal?.kind === 'checkout' && !plan.denied) {
      const active = this.registry.resolve(profileDeviceId);
      const current = active ? this.pending.get(active.session.id) : undefined;
      if (current && current.orderId && current.stage !== 'cancelled' && current.stage !== 'interrupted') {
        return {
          plan,
          commerce: current.commerce,
          operation: operationOf(current),
          metrics: null,
        };
      }
      this.proposalCount += 1;
      const proposalId = `proposal-${this.proposalCount}`;
      plan.proposal = { ...plan.proposal, proposalId };
      if (active) {
        this.pending.set(active.session.id, {
          proposalId,
          sku: plan.proposal.sku,
          qty: 1,
          stage: 'proposed',
          orderId: null,
          commerce: null,
        });
      }
      return {
        plan,
        commerce: null,
        operation: { stage: 'proposed', proposalId, orderId: null },
        metrics: null,
      };
    }
    return { plan, commerce: null, metrics: null, operation: plan.uncertainty === 'partial' ? { stage: 'interpreted', proposalId: null, orderId: null } : null };
  }

  private purchasePlan(
    manifest: ProfileManifest,
    avatarId: string,
    voicePreset: string,
    pending: PendingPurchase,
    kind: 'started' | 'already' | 'cancelled',
  ): ProfilePlan {
    const text = {
      started: {
        en: 'The simulated order is waiting for payment. Nothing is dispensed before payment is verified.',
        es: 'El pedido simulado espera el pago. No se entrega nada antes de verificar el pago.',
      },
      already: {
        en: 'That simulated payment is already open. I did not create another order.',
        es: 'Ese pago simulado ya está abierto. No creé otro pedido.',
      },
      cancelled: {
        en: pending.orderId
          ? 'I cancelled the simulated order and released the reservation.'
          : 'I dropped the proposal. No order was created.',
        es: pending.orderId
          ? 'Cancelé el pedido simulado y liberé la reserva.'
          : 'Descarté la propuesta. No se creó un pedido.',
      },
    }[kind];
    return {
      profileId: manifest.profileId,
      version: manifest.version,
      role: manifest.displayName,
      disclosure: manifest.disclosure,
      avatarId,
      voicePreset,
      text,
      knowledge: [],
      proposal: { kind: 'checkout', sku: pending.sku, qty: pending.qty, executed: false, proposalId: pending.proposalId },
      denied: null,
      uncertainty: 'stated',
    };
  }

  private finish(session: ProfileSession, result: TurnResult): TurnResult {
    session.metrics.turns += 1;
    if (result.plan.denied) session.metrics.denied += 1;
    if (result.plan.proposal?.kind === 'handoff') session.metrics.handoffs += 1;
    const summary = result.plan.denied
      ? `denied ${result.plan.denied}`
      : result.operation
        ? result.operation.stage
        : result.plan.proposal
          ? result.plan.proposal.kind
          : 'answer';
    this.registry.audit(session, 'turn', summary);
    return { ...result, metrics: session.metrics };
  }
}

function operationOf(pending: PendingPurchase): PurchaseOperation {
  return { stage: pending.stage, proposalId: pending.proposalId, orderId: pending.orderId };
}

function controlWord(utterance: string): 'confirm' | 'cancel' | null {
  const text = utterance.trim().toLowerCase().replace(/[.!]+$/u, '');
  if (['yes', 'confirm', 'confirmed', 'confirmo', 'confirma', 'sí', 'si', 'ok', 'de acuerdo', 'adelante'].includes(text)) return 'confirm';
  if (['cancel', 'cancelar', 'cancela', 'no', 'stop'].includes(text)) return 'cancel';
  return null;
}
