import {
  capabilityCatalog,
  type Actor,
  type ApprovalMethod,
  type CapabilityId,
  type Connectivity,
  type PolicyDecision,
  type RiskLevel,
} from '@physical-os/shared';

export interface PolicyDevice {
  id: string;
  connectivity: Connectivity;
  simulated: boolean;
  isolatedSimulator: boolean;
}

export interface PolicySettings {
  requireMediumConfirmation: boolean;
  allowIsolatedSimulatedHighRisk: boolean;
}

export interface PolicyInput {
  actor: Actor;
  capability: CapabilityId;
  action: string;
  device: PolicyDevice;
  estopLatched: boolean;
  approval: ApprovalMethod;
  settings: PolicySettings;
}

const READ_ROLES = new Set(['admin', 'operator', 'viewer', 'automation']);

export function evaluatePolicy(input: PolicyInput): PolicyDecision {
  const capability = capabilityCatalog[input.capability];
  const reasons: string[] = [];
  const risk: RiskLevel = capability.risk;

  if (!capability.actions[input.action]) {
    return { effect: 'deny', risk, reasons: ['unknown_action'] };
  }
  if (!READ_ROLES.has(input.actor.role) || input.actor.role === 'viewer') {
    return { effect: 'deny', risk, reasons: ['unauthorized'] };
  }
  if (input.estopLatched) {
    return { effect: 'deny', risk, reasons: ['estop_latched'] };
  }
  if (input.device.connectivity !== 'online') {
    return { effect: 'deny', risk, reasons: ['disconnected'] };
  }

  if (risk === 'high') {
    const isolated =
      input.settings.allowIsolatedSimulatedHighRisk &&
      input.device.simulated &&
      input.device.isolatedSimulator;
    if (!isolated) {
      return { effect: 'deny', risk, reasons: ['high_risk_disabled'] };
    }
    if (input.actor.role === 'automation' || input.approval === 'automation_rule') {
      return { effect: 'deny', risk, reasons: ['automation_cannot_actuate_high_risk'] };
    }
    if (input.approval === 'none') {
      return { effect: 'require_approval', risk, reasons: ['high_risk_simulated_requires_approval'] };
    }
    reasons.push('isolated_simulator_high_risk');
    return { effect: 'allow', risk, reasons };
  }

  if (risk === 'medium') {
    if (input.actor.role === 'automation') {
      if (input.approval !== 'automation_rule') {
        return { effect: 'deny', risk, reasons: ['unauthorized'] };
      }
      reasons.push('automation_rule');
      return { effect: 'allow', risk, reasons };
    }
    const confirmed =
      input.approval === 'explicit_ui' || input.approval === 'plan_approval';
    if (!confirmed && input.settings.requireMediumConfirmation) {
      return { effect: 'require_approval', risk, reasons: ['medium_risk_confirmation'] };
    }
    reasons.push(confirmed ? 'confirmed' : 'confirmation_not_required');
    return { effect: 'allow', risk, reasons };
  }

  reasons.push('low_risk');
  return { effect: 'allow', risk, reasons };
}
