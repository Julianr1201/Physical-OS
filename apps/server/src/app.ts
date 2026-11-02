import { randomBytes, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { PhysicalSystem, type PlanExecution } from '@physical-os/core';
import {
  DomainError,
  automationDefinitionSchema,
  automationJsonSchema,
  capabilityIdSchema,
  deviceKindSchema,
  type Actor,
  type CommandRecord,
} from '@physical-os/shared';
import { OpenAiCompatibleProvider } from '@physical-os/intelligence';
import { mqttConnectionSchema } from '@physical-os/adapter-mqtt';
import { CommerceService } from '@physical-os/commerce';
import { clearCookie, hashPassword, hashToken, newSessionToken, readCookie, sessionCookie, verifyPassword } from './auth.js';
import { registerCommerceRoutes, sendCommerceError } from './commerce-routes.js';
import { registerProfileRoutes, sendProfileError } from './profile-routes.js';
import { AppDatabase } from './db/database.js';
import { openApi } from './openapi.js';

const passwordSchema = z.string().min(12).max(200);
const setupSchema = z.object({ displayName: z.string().min(1).max(80), password: passwordSchema });
const loginSchema = z.object({ password: passwordSchema });
const environmentSchema = z.object({ name: z.string().min(1).max(80) });
const roomBodySchema = z.object({ environmentId: z.string().uuid(), name: z.string().min(1).max(80) });
const deviceBodySchema = z.object({
  environmentId: z.string().uuid(),
  roomId: z.string().uuid(),
  name: z.string().min(1).max(80),
  kind: deviceKindSchema,
  capabilities: z.array(capabilityIdSchema).min(1).max(8),
});
const commandBodySchema = z.object({
  capability: capabilityIdSchema,
  action: z.string().min(1).max(64),
  params: z.record(z.string().max(64), z.unknown()).default({}),
  approval: z.enum(['none', 'explicit_ui']).default('none'),
  idempotencyKey: z.string().min(8).max(80).optional(),
});
const signalSchema = z.object({
  environmentId: z.string().uuid(),
  name: z.literal('after_sunset'),
  value: z.boolean(),
});
const interpretSchema = z.object({
  environmentId: z.string().uuid(),
  utterance: z.string().min(1).max(500),
});
const readingSchema = z.object({
  capability: capabilityIdSchema,
  value: z.unknown(),
});
const faultSchema = z.object({
  latencyMs: z.number().int().min(0).max(30_000).optional(),
  disconnected: z.boolean().optional(),
  failNext: z.boolean().optional(),
});
const estopSchema = z.object({ reason: z.string().min(1).max(200) });
const resetSchema = z.object({ confirmation: z.literal('RESET') });
const settingsSchema = z.object({ requireMediumConfirmation: z.boolean().optional() });
const automationPatchSchema = z.object({
  enabled: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  name: z.string().min(1).max(120).optional(),
});

export interface BuildOptions {
  dataDir: string;
  logger?: boolean;
  secureCookie?: boolean;
  origins?: string[];
  allowIsolatedSimulatedHighRisk?: boolean;
}

export async function buildApp(options: BuildOptions) {
  const database = new AppDatabase(join(options.dataDir, 'physical-os.sqlite'));
  const system = new PhysicalSystem({
    store: database.snapshots,
    allowIsolatedSimulatedHighRisk:
      options.allowIsolatedSimulatedHighRisk ?? process.env.PHYSICAL_OS_SIM_HIGH_RISK === 'isolated',
    llm: languageModel(),
  });
  await system.start();
  const origins = options.origins ?? ['http://127.0.0.1:3000', 'http://localhost:3000'];
  const secure = options.secureCookie ?? process.env.PHYSICAL_OS_COOKIE_SECURE === '1';
  const limits = new Map<string, number[]>();
  const app = Fastify({
    logger: options.logger ? { redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'] } : false,
    bodyLimit: 256 * 1024,
  });

  app.addHook('onRequest', async (request, reply) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('x-frame-options', 'DENY');
    reply.header('cache-control', 'no-store');
    const origin = request.headers.origin;
    if (typeof origin === 'string' && !origins.includes(origin)) {
      return reply.code(403).send({ error: { code: 'origin_rejected', message: 'Origin is not allowed.' } });
    }
    return undefined;
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof DomainError) {
      return reply.code(error.httpStatus).send({ error: { code: error.code, message: error.message, details: error.details ?? null } });
    }
    if (sendCommerceError(error, reply)) return;
    if (sendProfileError(error, reply)) return;
    if (error instanceof z.ZodError) {
      return reply.code(422).send({
        error: { code: 'invalid_body', message: 'The request body is invalid.', details: error.issues.map((issue) => issue.message) },
      });
    }
    const statusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error && typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;
    if (statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send({ error: { code: 'invalid_request', message: 'The request could not be accepted.', details: null } });
    }
    app.log.error({ err: error }, 'request failed');
    return reply.code(500).send({ error: { code: 'internal', message: 'The request could not be completed.' } });
  });

  app.addHook('onClose', async () => {
    await system.stop();
    await database.close();
  });

  async function actor(request: FastifyRequest): Promise<Actor | null> {
    const token = readCookie(request.headers.cookie, 'pos_session');
    if (!token) return null;
    const session = await database.findSession(hashToken(token));
    if (!session || Date.parse(session.expiresAt) < Date.now()) return null;
    const user = (await database.listUsers()).find((item) => item.id === session.userId);
    if (!user) return null;
    return { id: user.id, role: user.role };
  }

  async function requireActor(request: FastifyRequest): Promise<Actor> {
    const current = await actor(request);
    if (!current) throw new DomainError('unauthenticated', 'Log in required.', 401);
    return current;
  }

  function tooMany(key: string, limit: number): boolean {
    const now = Date.now();
    const recent = (limits.get(key) ?? []).filter((stamp) => now - stamp < 60_000);
    if (recent.length >= limit) {
      limits.set(key, recent);
      return true;
    }
    recent.push(now);
    limits.set(key, recent);
    return false;
  }

  app.get('/api/v1/health', async () => ({ ok: true, service: 'physical-os', api: 'v1' }));
  app.get('/api/v1/openapi.json', async () => openApi);
  app.get('/api/v1/schemas/automation', async (request) => {
    await requireActor(request);
    return automationJsonSchema();
  });

  app.post('/api/v1/setup', async (request, reply) => {
    if (tooMany(`setup:${request.ip}`, 5)) return reply.code(429).send(limited());
    if ((await database.countUsers()) > 0) {
      throw new DomainError('already_enrolled', 'An administrator already exists.', 409);
    }
    const body = setupSchema.parse(request.body);
    const password = await hashPassword(body.password);
    const user = {
      id: randomUUID(),
      displayName: body.displayName,
      passwordHash: password.hash,
      passwordSalt: password.salt,
      role: 'admin' as const,
      createdAt: new Date().toISOString(),
    };
    await database.insertUser(user);
    return reply.code(201).send({ data: await issueSession(database, reply, user.id, secure) });
  });

  app.post('/api/v1/demo/session', async (request, reply) => {
    if (tooMany(`demo:${request.ip}`, 5)) return reply.code(429).send(limited());
    if ((await database.countUsers()) > 0) {
      throw new DomainError('already_enrolled', 'An administrator already exists.', 409);
    }
    const password = await hashPassword(randomBytes(24).toString('base64url'));
    const user = {
      id: randomUUID(),
      displayName: 'Local',
      passwordHash: password.hash,
      passwordSalt: password.salt,
      role: 'admin' as const,
      createdAt: new Date().toISOString(),
    };
    await database.insertUser(user);
    return reply.code(201).send({ data: { ...(await issueSession(database, reply, user.id, secure)), demo: true } });
  });

  app.post('/api/v1/session', async (request, reply) => {
    if (tooMany(`login:${request.ip}`, 5)) return reply.code(429).send(limited());
    const body = loginSchema.parse(request.body);
    const users = await database.listUsers();
    const user = users[0];
    if (!user || !(await verifyPassword(body.password, user.passwordSalt, user.passwordHash))) {
      return reply.code(401).send({ error: { code: 'invalid_credentials', message: 'The password is not valid.' } });
    }
    return { data: await issueSession(database, reply, user.id, secure) };
  });

  app.delete('/api/v1/session', async (request, reply) => {
    const token = readCookie(request.headers.cookie, 'pos_session');
    if (token) await database.deleteSession(hashToken(token));
    reply.header('set-cookie', clearCookie(secure));
    return { data: { ended: true } };
  });

  app.get('/api/v1/session', async (request) => {
    const enrolled = (await database.countUsers()) > 0;
    const current = await actor(request);
    if (!current) return { data: { authenticated: false, enrolled } };
    const user = (await database.listUsers()).find((item) => item.id === current.id);
    return { data: { authenticated: true, enrolled, displayName: user?.displayName ?? 'Administrator', role: current.role } };
  });

  app.get('/api/v1/overview', async (request) => {
    await requireActor(request);
    return { data: { ...system.overview(), mqtt: system.mqttPublic() } };
  });

  app.post('/api/v1/demo/simulated-home', async (request) => {
    const current = await requireActor(request);
    const created = system.createSimulatedHome(current);
    await system.whenIdle();
    return { data: { ...created, simulated: true, overview: system.overview() } };
  });

  app.post('/api/v1/environments', async (request) => {
    const current = await requireActor(request);
    const body = environmentSchema.parse(request.body);
    const environment = system.createEnvironment(body.name, current);
    await system.whenIdle();
    return { data: environment };
  });

  app.post('/api/v1/rooms', async (request) => {
    const current = await requireActor(request);
    const body = roomBodySchema.parse(request.body);
    return { data: system.createRoom(body.environmentId, body.name, current) };
  });

  app.post('/api/v1/devices', async (request) => {
    const current = await requireActor(request);
    const body = deviceBodySchema.parse(request.body);
    const device = system.addSimulatedDevice(body, current);
    await system.whenIdle();
    return { data: device };
  });

  app.post('/api/v1/devices/:id/commands', async (request, reply) => {
    if (tooMany(`cmd:${request.ip}`, 60)) return reply.code(429).send(limited());
    const current = await requireActor(request);
    const body = commandBodySchema.parse(request.body);
    const params = request.params as { id: string };
    const record = await system.executeCommand(
      {
        deviceId: params.id,
        capability: body.capability,
        action: body.action,
        params: body.params,
        approval: body.approval,
        idempotencyKey: body.idempotencyKey,
      },
      current,
    );
    await system.whenIdle();
    return reply.code(commandStatus(record)).send({ data: record });
  });

  app.post('/api/v1/commands/:id/approve', async (request, reply) => {
    const current = await requireActor(request);
    const params = request.params as { id: string };
    const record = await system.approveCommand(params.id, current);
    await system.whenIdle();
    return reply.code(commandStatus(record)).send({ data: record });
  });

  app.post('/api/v1/commands/:id/reject', async (request, reply) => {
    const current = await requireActor(request);
    const params = request.params as { id: string };
    const record = system.rejectCommand(params.id, current);
    await system.whenIdle();
    return reply.code(commandStatus(record)).send({ data: record });
  });

  app.post('/api/v1/signals', async (request) => {
    const current = await requireActor(request);
    const body = signalSchema.parse(request.body);
    system.setSignal(body.environmentId, body.name, body.value, current);
    await system.whenIdle();
    return { data: { name: body.name, value: body.value, simulated: true } };
  });

  app.post('/api/v1/automations', async (request) => {
    const current = await requireActor(request);
    const body = request.body as Record<string, unknown>;
    const automation = await system.createAutomation(
      automationDefinitionSchema.parse({ ...body, id: randomUUID(), schemaVersion: 1 }),
      current,
    );
    await system.whenIdle();
    return { data: automation };
  });

  app.patch('/api/v1/automations/:id', async (request) => {
    const current = await requireActor(request);
    const params = request.params as { id: string };
    const patch = automationPatchSchema.parse(request.body);
    const automation = system.updateAutomation(params.id, patch, current);
    await system.whenIdle();
    return { data: automation };
  });

  app.post('/api/v1/automations/:id/dry-run', async (request) => {
    const current = await requireActor(request);
    const params = request.params as { id: string };
    return { data: await system.dryRun(params.id, current) };
  });

  app.get('/api/v1/automations/:id/runs', async (request) => {
    await requireActor(request);
    const params = request.params as { id: string };
    return { data: system.listRuns(params.id) };
  });

  app.post('/api/v1/intelligence/interpret', async (request) => {
    const current = await requireActor(request);
    const body = interpretSchema.parse(request.body);
    const result = await system.interpretUtterance(body.utterance, body.environmentId, current);
    await system.whenIdle();
    return { data: result };
  });

  app.post('/api/v1/intelligence/:planId/approve', async (request) => {
    const current = await requireActor(request);
    const params = request.params as { planId: string };
    const execution: PlanExecution = await system.approvePlan(params.planId, current);
    await system.whenIdle();
    return { data: execution };
  });

  app.post('/api/v1/intelligence/:planId/reject', async (request) => {
    const current = await requireActor(request);
    const params = request.params as { planId: string };
    return { data: system.rejectPlan(params.planId, current) };
  });

  app.get('/api/v1/activity', async (request) => {
    await requireActor(request);
    return { data: system.listAudit(200) };
  });

  app.get('/api/v1/integrations', async (request) => {
    await requireActor(request);
    return { data: { health: await system.integrationHealth(), mqtt: system.mqttPublic() } };
  });

  app.post('/api/v1/integrations/mqtt', async (request) => {
    const current = await requireActor(request);
    const config = mqttConnectionSchema.parse(request.body);
    const health = await system.connectMqtt(config, current);
    await system.whenIdle();
    return { data: { health, mqtt: system.mqttPublic() } };
  });

  app.delete('/api/v1/integrations/mqtt', async (request) => {
    const current = await requireActor(request);
    await system.disconnectMqtt(current);
    await system.whenIdle();
    return { data: system.mqttPublic() };
  });

  app.post('/api/v1/devices/:id/readings', async (request) => {
    const current = await requireActor(request);
    const params = request.params as { id: string };
    const body = readingSchema.parse(request.body);
    const device = await system.injectReading(params.id, body.capability, body.value, current);
    return { data: device };
  });

  app.post('/api/v1/devices/:id/faults', async (request) => {
    const current = await requireActor(request);
    const params = request.params as { id: string };
    const body = faultSchema.parse(request.body);
    return { data: system.setSimulatorFault(params.id, body, current) };
  });

  app.post('/api/v1/safety/estop', async (request) => {
    const current = await requireActor(request);
    const body = estopSchema.parse(request.body);
    system.latchEstop(body.reason, current);
    await system.whenIdle();
    return { data: system.overview().estop };
  });

  app.post('/api/v1/safety/estop/reset', async (request) => {
    const current = await requireActor(request);
    const body = resetSchema.parse(request.body);
    system.resetEstop(body.confirmation, current);
    await system.whenIdle();
    return { data: system.overview().estop };
  });

  app.patch('/api/v1/settings', async (request) => {
    const current = await requireActor(request);
    const body = settingsSchema.parse(request.body);
    const settings = system.updateSettings(body, current);
    await system.whenIdle();
    return { data: settings };
  });

  app.get('/api/v1/events', async (request, reply) => {
    const current = await actor(request);
    if (!current) return reply.code(401).send({ error: { code: 'unauthenticated', message: 'Log in required.' } });
    reply.hijack();
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    reply.raw.write('retry: 3000\n\n');
    const unsubscribe = system.bus.subscribe('*', (event) => {
      reply.raw.write(`data: ${JSON.stringify({ type: event.type, at: event.at })}\n\n`);
    });
    const timer = setInterval(() => reply.raw.write(': ping\n\n'), 20_000);
    timer.unref?.();
    request.raw.on('close', () => {
      clearInterval(timer);
      unsubscribe();
    });
    return undefined;
  });

  const commerce = new CommerceService();
  registerCommerceRoutes(app, commerce, requireActor, origins);
  registerProfileRoutes(app, commerce, requireActor);

  return { app, system, database };
}

function commandStatus(record: CommandRecord): number {
  switch (record.outcome) {
    case 'verified':
      return 200;
    case 'delivered':
    case 'awaiting_approval':
    case 'accepted':
      return 202;
    case 'rejected':
      return 403;
    case 'timed_out':
      return 504;
    default:
      return 409;
  }
}

function limited() {
  return { error: { code: 'rate_limited', message: 'Too many attempts. Wait a minute and try again.' } };
}

async function issueSession(database: AppDatabase, reply: FastifyReply, userId: string, secure: boolean) {
  const session = newSessionToken();
  await database.insertSession({
    tokenHash: session.tokenHash,
    userId,
    expiresAt: session.expiresAt,
    createdAt: new Date().toISOString(),
  });
  reply.header('set-cookie', sessionCookie(session.token, secure));
  return { authenticated: true };
}

function languageModel(): OpenAiCompatibleProvider | null {
  const baseUrl = process.env.PHYSICAL_OS_LLM_BASE_URL;
  const apiKey = process.env.PHYSICAL_OS_LLM_API_KEY;
  const model = process.env.PHYSICAL_OS_LLM_MODEL;
  if (!baseUrl || !apiKey || !model) return null;
  return new OpenAiCompatibleProvider(baseUrl, apiKey, model);
}
