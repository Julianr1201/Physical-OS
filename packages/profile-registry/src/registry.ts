import { randomUUID } from 'node:crypto';
import { constraintById, deniedTool } from '@physical-os/industry-policies';
import { avatarById, parseManifest, profileById, voiceById, type ProfileManifest } from '@physical-os/professional-profiles';
import { ProfileError } from './errors.js';
import { verifyManifest } from './trust.js';

export interface InstalledProfile {
  manifest: ProfileManifest;
  trust: 'bundled' | 'signed';
  history: ProfileManifest[];
  acceptedPermissions: string[];
  installedAt: string;
}

export interface ProfileDeployment {
  id: string;
  organizationId: string;
  organizationName: string;
  profileId: string;
  version: string;
  avatarId: string;
  voicePreset: string;
  deviceId: string;
  simulated: true;
  active: boolean;
  removed: boolean;
}

export interface ProfileSession {
  id: string;
  deploymentId: string;
  deviceId: string;
  profileId: string;
  version: string;
  organizationId: string;
  avatarId: string;
  voicePreset: string;
  startedAt: string;
  closed: boolean;
  metrics: { turns: number; handoffs: number; denied: number; checkouts: number };
  audit: Array<{ at: string; action: string; summary: string }>;
}

export interface RegistryOptions {
  mode: 'simulation' | 'production';
  trustKey: string;
  now?: () => Date;
}

export class ProfileRegistry {
  private readonly installed = new Map<string, InstalledProfile>();
  private readonly deployments = new Map<string, ProfileDeployment>();
  private readonly sessions = new Map<string, ProfileSession>();
  private readonly now: () => Date;

  constructor(private readonly options: RegistryOptions) {
    this.now = options.now ?? (() => new Date());
  }

  installBundled(profileId: string): InstalledProfile {
    if (this.options.mode !== 'simulation') {
      throw new ProfileError('bundled_trust_disabled', 'Bundled profiles are only trusted in simulation.', 403);
    }
    const manifest = profileById(profileId);
    if (!manifest) throw new ProfileError('unknown_profile', 'That profile is not in the starter catalog.', 404);
    return this.store(manifest, 'bundled');
  }

  installSigned(raw: unknown, signature: string): InstalledProfile {
    const manifest = this.readTrusted(raw, signature);
    return this.store(manifest, 'signed');
  }

  update(raw: unknown, signature: string | undefined, acceptedPermissions: string[]): InstalledProfile {
    const manifest = this.options.mode === 'production' || signature ? this.readTrusted(raw, signature ?? '') : parseManifest(raw);
    const current = this.installed.get(manifest.profileId);
    if (!current) throw new ProfileError('not_installed', 'Install the profile before updating it.', 404);
    if (this.options.mode === 'simulation' && !signature && current.trust !== 'bundled') {
      throw new ProfileError('signature_required', 'This package needs a trusted signature.', 403);
    }
    this.assertManifest(manifest);
    const added = manifest.requiredPermissions.filter((item) => !current.manifest.requiredPermissions.includes(item));
    const missing = added.filter((item) => !acceptedPermissions.includes(item));
    if (missing.length > 0) {
      throw new ProfileError('permission_grant_required', `Accept the new permissions: ${missing.join(', ')}.`, 409);
    }
    current.history.push(current.manifest);
    current.manifest = manifest;
    current.acceptedPermissions = [...new Set([...current.acceptedPermissions, ...acceptedPermissions, ...manifest.requiredPermissions])];
    return current;
  }

  rollback(profileId: string, version: string): InstalledProfile {
    const current = this.requireInstalled(profileId);
    const target = current.history.find((item) => item.version === version);
    if (!target) throw new ProfileError('unknown_version', 'That version is not in the installed history.', 404);
    const added = target.requiredPermissions.filter((item) => !current.acceptedPermissions.includes(item) && !current.manifest.requiredPermissions.includes(item));
    if (added.length > 0) throw new ProfileError('permission_grant_required', 'Rollback would grant a permission that was not accepted.', 409);
    current.history.push(current.manifest);
    current.manifest = target;
    return current;
  }

  activate(input: {
    profileId: string;
    avatarId: string;
    voicePreset: string;
    organizationName: string;
    deviceId: string;
    acceptedPermissions: string[];
  }): { deployment: ProfileDeployment; session: ProfileSession } {
    const installed = this.requireInstalled(input.profileId);
    const missing = installed.manifest.requiredPermissions.filter((item) => !input.acceptedPermissions.includes(item));
    if (missing.length > 0) {
      throw new ProfileError('permission_grant_required', `Accept the permissions: ${missing.join(', ')}.`, 409);
    }
    if (!avatarById(input.avatarId) || !voiceById(input.voicePreset)) {
      throw new ProfileError('unknown_appearance', 'Choose an approved figure and voice.', 422);
    }
    for (const deployment of this.deployments.values()) {
      if (deployment.deviceId === input.deviceId && deployment.active) deployment.active = false;
    }
    for (const session of this.sessions.values()) {
      if (session.deviceId === input.deviceId && !session.closed) session.closed = true;
    }
    installed.acceptedPermissions = [...new Set([...installed.acceptedPermissions, ...input.acceptedPermissions])];
    const deployment: ProfileDeployment = {
      id: randomUUID(),
      organizationId: randomUUID(),
      organizationName: input.organizationName,
      profileId: installed.manifest.profileId,
      version: installed.manifest.version,
      avatarId: input.avatarId,
      voicePreset: input.voicePreset,
      deviceId: input.deviceId,
      simulated: true,
      active: true,
      removed: false,
    };
    const session = this.openSession(deployment);
    this.deployments.set(deployment.id, deployment);
    this.audit(session, 'activate', installed.manifest.profileId);
    return { deployment, session };
  }

  remove(profileId: string): void {
    const installed = this.requireInstalled(profileId);
    this.installed.delete(installed.manifest.profileId);
    for (const deployment of this.deployments.values()) {
      if (deployment.profileId !== profileId) continue;
      deployment.active = false;
      deployment.removed = true;
    }
    for (const session of this.sessions.values()) {
      if (session.profileId === profileId) session.closed = true;
    }
  }

  resolve(deviceId: string): { deployment: ProfileDeployment; session: ProfileSession; manifest: ProfileManifest } | null {
    const deployment = [...this.deployments.values()].find((item) => item.deviceId === deviceId && item.active && !item.removed);
    if (!deployment) return null;
    const installed = this.installed.get(deployment.profileId);
    const session = [...this.sessions.values()].find((item) => item.deploymentId === deployment.id && !item.closed);
    if (!installed || !session) return null;
    return { deployment, session, manifest: installed.manifest };
  }

  listInstalled(): InstalledProfile[] {
    return [...this.installed.values()];
  }

  session(id: string): ProfileSession | null {
    return this.sessions.get(id) ?? null;
  }

  audit(session: ProfileSession, action: string, summary: string): void {
    session.audit.push({ at: this.now().toISOString(), action, summary });
    if (session.audit.length > 200) session.audit.shift();
  }

  private openSession(deployment: ProfileDeployment): ProfileSession {
    const session: ProfileSession = {
      id: randomUUID(),
      deploymentId: deployment.id,
      deviceId: deployment.deviceId,
      profileId: deployment.profileId,
      version: deployment.version,
      organizationId: deployment.organizationId,
      avatarId: deployment.avatarId,
      voicePreset: deployment.voicePreset,
      startedAt: this.now().toISOString(),
      closed: false,
      metrics: { turns: 0, handoffs: 0, denied: 0, checkouts: 0 },
      audit: [],
    };
    this.sessions.set(session.id, session);
    return session;
  }

  private store(manifest: ProfileManifest, trust: 'bundled' | 'signed'): InstalledProfile {
    this.assertManifest(manifest);
    const record: InstalledProfile = {
      manifest,
      trust,
      history: [],
      acceptedPermissions: [],
      installedAt: this.now().toISOString(),
    };
    this.installed.set(manifest.profileId, record);
    return record;
  }

  private readTrusted(raw: unknown, signature: string): ProfileManifest {
    const manifest = parseManifest(raw);
    if (!verifyManifest(manifest, signature, this.options.trustKey)) {
      throw new ProfileError('signature_rejected', 'The package signature is not trusted.', 403);
    }
    return manifest;
  }

  private assertManifest(manifest: ProfileManifest): void {
    if (manifest.safetyPolicies.some((id) => !constraintById(id))) {
      throw new ProfileError('unknown_policy', 'The profile names a safety policy that does not exist.', 422);
    }
    if (!avatarById(manifest.presencePreset) || !voiceById(manifest.voicePreset)) {
      throw new ProfileError('unknown_appearance', 'The profile preset is not an approved figure or voice.', 422);
    }
    const blocked = manifest.tools.find((tool) => deniedTool(manifest.safetyPolicies, tool.id));
    if (blocked) throw new ProfileError('tool_denied', `The tool ${blocked.id} is denied by safety policy.`, 403);
  }

  private requireInstalled(profileId: string): InstalledProfile {
    const installed = this.installed.get(profileId);
    if (!installed) throw new ProfileError('not_installed', 'That profile is not installed.', 404);
    return installed;
  }
}
