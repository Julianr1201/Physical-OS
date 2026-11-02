import { retrieveKnowledge } from '@physical-os/knowledge-connectors';
import { starterProfiles, type ProfileManifest } from '@physical-os/professional-profiles';
import { ProfileError, ProfileRegistry, type ProfileSession } from '@physical-os/profile-registry';
import { planTurn, type ProfilePlan } from './plan.js';

export const profileDeviceId = 'console';

export interface CheckoutResult {
  orderId: string;
  status: string;
  paymentCaptured: boolean;
  dispenseVerified: boolean;
  simulated: true;
}

export type CheckoutPort = (sku: string, qty: number) => CheckoutResult;

export interface TurnResult {
  plan: ProfilePlan;
  commerce: CheckoutResult | null;
  metrics: ProfileSession['metrics'] | null;
}

export class ProfileHost {
  readonly registry: ProfileRegistry;

  constructor(
    private readonly options: {
      mode?: 'simulation' | 'production';
      trustKey?: string;
      now?: () => Date;
      checkout?: CheckoutPort;
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
    return this.answer(installed.manifest, installed.manifest.presencePreset, installed.manifest.voicePreset, utterance).plan;
  }

  turn(utterance: string): TurnResult {
    const active = this.registry.resolve(profileDeviceId);
    if (!active) throw new ProfileError('no_active_profile', 'Activate a profile first.', 409);
    const result = this.answer(active.manifest, active.deployment.avatarId, active.deployment.voicePreset, utterance);
    active.session.metrics.turns += 1;
    if (result.plan.denied) active.session.metrics.denied += 1;
    if (result.plan.proposal?.kind === 'handoff') active.session.metrics.handoffs += 1;
    if (result.commerce) active.session.metrics.checkouts += 1;
    const summary = result.plan.denied
      ? `denied ${result.plan.denied}`
      : result.plan.proposal
        ? result.plan.proposal.kind
        : 'answer';
    this.registry.audit(active.session, 'turn', summary);
    return { ...result, metrics: active.session.metrics };
  }

  private answer(manifest: ProfileManifest, avatarId: string, voicePreset: string, utterance: string): TurnResult {
    const now = this.options.now?.() ?? new Date();
    const knowledge = retrieveKnowledge(manifest.knowledgeSources, utterance, now);
    const plan = planTurn(manifest, avatarId, voicePreset, utterance, knowledge);
    if (plan.proposal?.kind === 'checkout' && !plan.denied && this.options.checkout) {
      return { plan, commerce: this.options.checkout(plan.proposal.sku, plan.proposal.qty), metrics: null };
    }
    return { plan, commerce: null, metrics: null };
  }
}
