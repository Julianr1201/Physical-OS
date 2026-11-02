import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import QRCode from 'qrcode';
import { z } from 'zod';
import { CommerceError, type CommerceService } from '@physical-os/commerce';

const checkoutSchema = z.object({
  lines: z.array(z.object({ sku: z.string().min(1).max(40), qty: z.number().int().min(1).max(5) })).min(1).max(8),
  handoffOrigin: z.string().url().max(120),
});
const callbackSchema = z.object({
  body: z.string().min(2).max(4000),
  signature: z.string().regex(/^[a-f0-9]{64}$/),
});
const tokenSchema = z.object({ token: z.string().min(20).max(200) });

export function registerCommerceRoutes(
  app: FastifyInstance,
  commerce: CommerceService,
  requireActor: (request: FastifyRequest) => Promise<unknown>,
  origins: string[],
): void {
  app.get('/api/v1/commerce/catalog', async (request) => {
    await requireActor(request);
    return { data: { simulated: true, items: commerce.listCatalog(), nfc: commerce.nfc() } };
  });

  app.post('/api/v1/commerce/checkout', async (request) => {
    await requireActor(request);
    const body = checkoutSchema.parse(request.body);
    if (!origins.includes(body.handoffOrigin)) {
      throw new CommerceError('origin_rejected', 'That handoff address is not allowed.', 403);
    }
    const created = commerce.checkout(body.lines);
    const url = `${body.handoffOrigin}/kiosk/pay/${created.order.id}?t=${encodeURIComponent(created.payToken)}`;
    const qrSvg = await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#101419', light: '#F1F5F5' } });
    return {
      data: {
        simulated: true,
        order: created.order,
        session: created.session,
        qrSvg,
      },
    };
  });

  app.get('/api/v1/commerce/orders/:id', async (request) => {
    await requireActor(request);
    const params = request.params as { id: string };
    return { data: commerce.getOrder(params.id) };
  });

  app.post('/api/v1/commerce/orders/:id/cancel', async (request) => {
    await requireActor(request);
    const params = request.params as { id: string };
    return { data: commerce.cancel(params.id) };
  });

  app.post('/api/v1/commerce/orders/:id/pay-simulation', async (request) => {
    await requireActor(request);
    const params = request.params as { id: string };
    return { data: commerce.simulatePayment(params.id) };
  });

  app.post('/api/v1/commerce/orders/:id/retry', async (request) => {
    await requireActor(request);
    const params = request.params as { id: string };
    return { data: commerce.retryFulfillment(params.id) };
  });

  app.post('/api/v1/commerce/orders/:id/verify', async (request) => {
    await requireActor(request);
    const params = request.params as { id: string };
    return { data: commerce.verifyFulfillment(params.id) };
  });

  app.post('/api/v1/commerce/orders/:id/refund', async (request) => {
    await requireActor(request);
    const params = request.params as { id: string };
    return { data: commerce.refund(params.id) };
  });

  app.get('/api/v1/commerce/orders/:id/receipt', async (request) => {
    await requireActor(request);
    const params = request.params as { id: string };
    return { data: commerce.receipt(params.id) };
  });

  app.post('/api/v1/commerce/payments/callback', async (request, reply) => {
    await requireActor(request);
    const body = callbackSchema.parse(request.body);
    return reply.code(200).send({ data: commerce.applyCallback(body.body, body.signature) });
  });

  app.get('/api/v1/commerce/handoff/:id', async (request, reply) => {
    const params = request.params as { id: string };
    const query = tokenSchema.parse(request.query);
    if (!commerce.tokenMatches(params.id, query.token)) {
      return reply.code(401).send({ error: { code: 'invalid_token', message: 'The payment link is not valid.', details: null } });
    }
    const order = commerce.getOrder(params.id);
    return {
      data: {
        simulated: true,
        id: order.id,
        status: order.status,
        totalCents: order.totalCents,
        currency: order.currency,
        lines: order.lines.map((line) => ({ sku: line.sku, name: line.name, qty: line.qty, lineCents: line.lineCents })),
        paymentCaptured: order.paymentCaptured,
        dispenseVerified: order.dispenseVerified,
        failureReason: order.failureReason,
      },
    };
  });

  app.post('/api/v1/commerce/handoff/:id/pay-simulation', async (request, reply) => {
    const params = request.params as { id: string };
    const body = tokenSchema.parse(request.body);
    if (!commerce.tokenMatches(params.id, body.token)) {
      return reply.code(401).send({ error: { code: 'invalid_token', message: 'The payment link is not valid.', details: null } });
    }
    return { data: commerce.simulatePayment(params.id) };
  });
}

export function sendCommerceError(error: unknown, reply: FastifyReply): boolean {
  if (!(error instanceof CommerceError)) return false;
  void reply.code(error.httpStatus).send({ error: { code: error.code, message: error.message, details: null } });
  return true;
}
