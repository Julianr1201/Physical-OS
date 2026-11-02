export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => null)) as { data?: T; error?: { message?: string; code?: string } } | null;
  if (!response.ok) {
    throw new ApiError(body?.error?.message ?? 'Request failed', body?.error?.code ?? 'request_failed', response.status);
  }
  return (body?.data ?? body) as T;
}

export interface Device {
  id: string;
  name: string;
  roomId: string;
  environmentId: string;
  manufacturer: string | null;
  adapterId: string;
  capabilities: string[];
  connectivity: string;
  observed: Record<string, Record<string, unknown>>;
  desired: Record<string, Record<string, unknown>>;
  observedAt: string | null;
  metadata: Record<string, string | number | boolean | null>;
}

export interface Overview {
  environments: Array<{ id: string; name: string; simulated: boolean }>;
  rooms: Array<{ id: string; environmentId: string; name: string }>;
  devices: Device[];
  automations: Array<{
    id: string;
    name: string;
    enabled: boolean;
    dryRun: boolean;
    environmentId: string;
    trigger: { type: string };
    actions: unknown[];
  }>;
  estop: { latched: boolean; reason: string | null };
  settings: { requireMediumConfirmation: boolean };
  signals: Array<{ environmentId: string; name: string; value: boolean | number | string }>;
  mqtt: { configured: boolean; url?: string; username?: string; deviceCount: number; passwordSet: boolean };
}

export interface CommandResult {
  id: string;
  outcome: string;
  verified: boolean;
  errorMessage: string | null;
  decision: { risk: string; reasons: string[] };
}

export interface AuditEntry {
  id: string;
  at: string;
  actorId: string;
  action: string;
  outcome: string;
  target: string | null;
  details: Record<string, unknown>;
}
