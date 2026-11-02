import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { CommerceService } from '@physical-os/commerce';
import { avatarCatalog, voiceCatalog, ProfileError, ProfileHost } from '@physical-os/profile-sdk';

const installSchema = z.object({ profileId: z.string().min(3).max(80) });
const signedSchema = z.object({ manifest: z.unknown(), signature: z.string().regex(/^[a-f0-9]{64}$/) });
const updateSchema = signedSchema.extend({ acceptedPermissions: z.array(z.string().min(1).max(80)).max(20) });
const activateSchema = z.object({
  profileId: z.string().min(3).max(80),
  avatarId: z.string().min(3).max(40),
  voicePreset: z.string().min(3).max(40),
  organizationName: z.string().min(1).max(80),
  acceptedPermissions: z.array(z.string().min(1).max(80)).max(20),
});
const versionSchema = z.object({ profileId: z.string().min(3).max(80), version: z.string().regex(/^\d+\.\d+\.\d+$/) });
const removeSchema = z.object({ profileId: z.string().min(3).max(80) });
const turnSchema = z.object({ profileId: z.string().min(3).max(80).optional(), utterance: z.string().min(1).max(500) });

export function registerProfileRoutes(
  app: FastifyInstance,
  commerce: CommerceService,
  requireActor: (request: FastifyRequest) => Promise<unknown>,
): ProfileHost {
  const host = new ProfileHost({
    mode: 'simulation',
    checkout: (sku, qty) => {
      const created = commerce.checkout([{ sku, qty }]);
      return {
        orderId: created.order.id,
        status: created.order.status,
        paymentCaptured: created.order.paymentCaptured,
        dispenseVerified: created.order.dispenseVerified,
        simulated: true,
      };
    },
  });

  app.get('/api/v1/profiles/catalog', async (request) => {
    await requireActor(request);
    return { data: { simulated: true, profiles: host.catalog(), avatars: avatarCatalog, voices: voiceCatalog, installed: host.registry.listInstalled() } };
  });

  app.get('/api/v1/profiles/active', async (request) => {
    await requireActor(request);
    const active = host.registry.resolve('console');
    return {
      data: active
        ? {
            simulated: true,
            profileId: active.manifest.profileId,
            version: active.manifest.version,
            role: active.manifest.displayName,
            disclosure: active.manifest.disclosure,
            industry: active.manifest.industry,
            avatarId: active.deployment.avatarId,
            voicePreset: active.deployment.voicePreset,
            organizationName: active.deployment.organizationName,
            metrics: active.session.metrics,
          }
        : null,
    };
  });

  app.post('/api/v1/profiles/install', async (request) => {
    await requireActor(request);
    const body = installSchema.parse(request.body);
    return { data: publicInstalled(host.registry.installBundled(body.profileId)) };
  });

  app.post('/api/v1/profiles/install-signed', async (request) => {
    await requireActor(request);
    const body = signedSchema.parse(request.body);
    return { data: publicInstalled(host.registry.installSigned(body.manifest, body.signature)) };
  });

  app.post('/api/v1/profiles/update', async (request) => {
    await requireActor(request);
    const body = updateSchema.parse(request.body);
    return { data: publicInstalled(host.registry.update(body.manifest, body.signature, body.acceptedPermissions)) };
  });

  app.post('/api/v1/profiles/activate', async (request) => {
    await requireActor(request);
    const body = activateSchema.parse(request.body);
    const activated = host.registry.activate({ ...body, deviceId: 'console' });
    return {
      data: {
        deploymentId: activated.deployment.id,
        sessionId: activated.session.id,
        profileId: activated.deployment.profileId,
        avatarId: activated.deployment.avatarId,
        voicePreset: activated.deployment.voicePreset,
      },
    };
  });

  app.post('/api/v1/profiles/rollback', async (request) => {
    await requireActor(request);
    const body = versionSchema.parse(request.body);
    return { data: publicInstalled(host.registry.rollback(body.profileId, body.version)) };
  });

  app.post('/api/v1/profiles/remove', async (request) => {
    await requireActor(request);
    const body = removeSchema.parse(request.body);
    host.registry.remove(body.profileId);
    return { data: { removed: body.profileId } };
  });

  app.post('/api/v1/profiles/preview', async (request) => {
    await requireActor(request);
    const body = turnSchema.parse(request.body);
    if (!body.profileId) throw new ProfileError('not_installed', 'Choose a profile to preview.', 422);
    return { data: { simulated: true, plan: host.preview(body.profileId, body.utterance), commerce: null } };
  });

  app.post('/api/v1/profiles/turn', async (request) => {
    await requireActor(request);
    const body = turnSchema.parse(request.body);
    const result = host.turn(body.utterance);
    return { data: { simulated: true, plan: result.plan, commerce: result.commerce, metrics: result.metrics } };
  });

  return host;
}

export function sendProfileError(error: unknown, reply: FastifyReply): boolean {
  if (!(error instanceof ProfileError)) return false;
  void reply.code(error.httpStatus).send({ error: { code: error.code, message: error.message, details: null } });
  return true;
}

function publicInstalled(record: { manifest: { profileId: string; version: string; requiredPermissions: string[] }; trust: string }) {
  return {
    profileId: record.manifest.profileId,
    version: record.manifest.version,
    trust: record.trust,
    requiredPermissions: record.manifest.requiredPermissions,
  };
}
