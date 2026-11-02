import { randomUUID } from 'node:crypto';
import {
  DomainError,
  valuesMatch,
  type Actor,
  type Automation,
  type AutomationCondition,
  type AutomationRun,
  type CapabilityId,
  type CommandRecord,
  type Device,
  type DomainEvent,
  type SignalValue,
} from '@physical-os/shared';

const MAX_DEPTH = 3;

export interface AutomationContext {
  now(): Date;
  device(id: string): Device | null;
  signal(environmentId: string, name: string): SignalValue | undefined;
}

export interface AutomationHost extends AutomationContext {
  execute(
    automation: Automation,
    actionIndex: number,
    causation: { automationId: string; depth: number; rootCorrelationId: string },
    timeoutMs: number,
  ): Promise<CommandRecord>;
  recordRun(run: AutomationRun): void;
}

export function evaluateCondition(condition: AutomationCondition, automation: Automation, ctx: AutomationContext): boolean {
  switch (condition.type) {
    case 'all':
      return condition.items.every((item) => evaluateCondition(item, automation, ctx));
    case 'any':
      return condition.items.some((item) => evaluateCondition(item, automation, ctx));
    case 'not':
      return !evaluateCondition(condition.item, automation, ctx);
    case 'signal':
      return ctx.signal(automation.environmentId, condition.signal) === condition.equals;
    case 'state': {
      const device = ctx.device(condition.deviceId);
      if (!device) return false;
      return valuesMatch(condition.match, device.observed[condition.capability]);
    }
    case 'time_window': {
      const minute = ctx.now().getHours() * 60 + ctx.now().getMinutes();
      const { startMinute, endMinute } = condition;
      if (startMinute <= endMinute) return minute >= startMinute && minute <= endMinute;
      return minute >= startMinute || minute <= endMinute;
    }
    default:
      return false;
  }
}

export class AutomationEngine {
  private readonly lastRunAt = new Map<string, number>();
  private readonly recentRuns = new Map<string, number[]>();
  private readonly dailyStamp = new Map<string, string>();
  private handling = false;
  private queued: DomainEvent[] = [];

  constructor(
    private readonly host: AutomationHost,
    private readonly list: () => Automation[],
  ) {}

  async handle(event: DomainEvent): Promise<void> {
    this.queued.push(event);
    if (this.handling) return;
    this.handling = true;
    try {
      while (this.queued.length > 0) {
        const next = this.queued.shift();
        if (!next) break;
        await this.handleOne(next);
      }
    } finally {
      this.handling = false;
    }
  }

  async manualDryRun(automation: Automation): Promise<void> {
    await this.run({ ...automation, dryRun: true, enabled: true }, 'manual', null, 0);
  }

  async tick(now = this.host.now()): Promise<void> {
    for (const automation of this.list()) {
      if (!automation.enabled || automation.trigger.type !== 'time') continue;
      if (!this.timeDue(automation, now)) continue;
      await this.run(automation, 'time', null, 0);
    }
  }

  private async handleOne(event: DomainEvent): Promise<void> {
    if ((event.causation?.depth ?? 0) >= MAX_DEPTH) return;
    for (const automation of this.list()) {
      if (!automation.enabled) continue;
      if (event.causation?.automationId === automation.id) continue;
      if (!this.triggerMatches(automation, event)) continue;
      await this.run(automation, event.type, event.correlationId, event.causation?.depth ?? 0);
    }
  }

  private triggerMatches(automation: Automation, event: DomainEvent): boolean {
    const trigger = automation.trigger;
    if (trigger.type === 'event') {
      if (event.type !== trigger.event) return false;
      if (event.type !== 'device.state.changed' && event.type !== 'sensor.reading.received') return false;
      if (trigger.deviceId && event.deviceId !== trigger.deviceId) return false;
      if (trigger.capability && event.capability !== trigger.capability) return false;
      if (trigger.match) {
        const slice =
          event.type === 'sensor.reading.received'
            ? event.reading
            : event.capability
              ? event.observed[event.capability]
              : event.observed;
        if (!valuesMatch(trigger.match, slice)) return false;
      }
      return true;
    }
    if (trigger.type === 'signal') {
      return (
        event.type === 'environment.signal.changed' &&
        event.signal === trigger.signal &&
        event.value === trigger.equals
      );
    }
    return false;
  }

  private timeDue(automation: Automation, now: Date): boolean {
    const trigger = automation.trigger;
    if (trigger.type !== 'time') return false;
    if (trigger.mode === 'interval') {
      const every = trigger.everyMs ?? Number.MAX_SAFE_INTEGER;
      const last = this.lastRunAt.get(automation.id) ?? 0;
      return now.getTime() - last >= every;
    }
    const minute = now.getHours() * 60 + now.getMinutes();
    if (trigger.atMinuteOfDay !== minute) return false;
    const stamp = now.toISOString().slice(0, 10);
    return this.dailyStamp.get(automation.id) !== stamp;
  }

  private async run(
    automation: Automation,
    source: string,
    correlationId: string | null,
    incomingDepth: number,
  ): Promise<void> {
    const depth = incomingDepth + 1;
    if (depth > MAX_DEPTH) return;
    const nowMs = this.host.now().getTime();
    const last = this.lastRunAt.get(automation.id) ?? 0;
    if (automation.cooldownMs > 0 && nowMs - last < automation.cooldownMs) {
      this.finish(automation, 'skipped', 'cooldown', [], true);
      return;
    }
    const recent = (this.recentRuns.get(automation.id) ?? []).filter((stamp) => nowMs - stamp < 3_600_000);
    if (recent.length >= automation.maxRunsPerHour) {
      this.recentRuns.set(automation.id, recent);
      this.finish(automation, 'skipped', 'rate_limit', [], false);
      return;
    }
    if (!evaluateCondition(automation.conditions, automation, this.host)) {
      this.finish(automation, 'skipped', 'conditions', [], false);
      return;
    }

    this.lastRunAt.set(automation.id, nowMs);
    recent.push(nowMs);
    this.recentRuns.set(automation.id, recent);
    if (automation.trigger.type === 'time' && automation.trigger.mode === 'daily') {
      this.dailyStamp.set(automation.id, this.host.now().toISOString().slice(0, 10));
    }

    if (automation.dryRun) {
      this.finish(automation, 'completed', `dry_run:${source}`, [], true);
      return;
    }

    const root = correlationId ?? randomUUID();
    const commandIds: string[] = [];
    try {
      const work = (async () => {
        for (let index = 0; index < automation.actions.length; index += 1) {
          const record = await this.host.execute(
            automation,
            index,
            { automationId: automation.id, depth, rootCorrelationId: root },
            automation.timeoutMs,
          );
          commandIds.push(record.id);
          if (record.outcome === 'failed' || record.outcome === 'rejected' || record.outcome === 'timed_out') {
            throw new DomainError(record.errorCode ?? 'action_failed', record.errorMessage ?? 'Action failed');
          }
        }
      })();
      await Promise.race([
        work,
        delay(automation.timeoutMs).then(() => {
          throw new DomainError('timeout', 'Automation timed out.');
        }),
      ]);
      this.finish(automation, 'completed', source, commandIds, false);
    } catch (error) {
      const timedOut = error instanceof DomainError && error.code === 'timeout';
      this.finish(
        automation,
        timedOut ? 'timed_out' : 'failed',
        error instanceof Error ? error.message : 'failed',
        commandIds,
        false,
      );
    }
  }

  private finish(
    automation: Automation,
    status: AutomationRun['status'],
    reason: string,
    commandIds: string[],
    countAsRun: boolean,
  ): void {
    if (!countAsRun && status === 'skipped') {
      // Conditions and rate limits stay out of the cooldown clock.
    }
    this.host.recordRun({
      id: randomUUID(),
      automationId: automation.id,
      at: this.host.now().toISOString(),
      dryRun: automation.dryRun,
      status,
      reason,
      commandIds,
    });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function automationActor(automationId: string): Actor {
  return { id: `automation:${automationId}`, role: 'automation', automationId };
}

export type { CapabilityId };
