import type { DomainEvent, DomainEventType } from '@physical-os/shared';

type Handler = (event: DomainEvent) => void | Promise<void>;

/**
 * Serial event bus. Nested publish() calls enqueue work on the current drain
 * instead of waiting for it, so a handler can emit follow-up events without
 * deadlocking.
 */
export class EventBus {
  private readonly handlers = new Map<DomainEventType | '*', Set<Handler>>();
  private readonly queue: DomainEvent[] = [];
  private drainPromise: Promise<void> | null = null;

  subscribe(type: DomainEventType | '*', handler: Handler): () => void {
    const set = this.handlers.get(type) ?? new Set<Handler>();
    set.add(handler);
    this.handlers.set(type, set);
    return () => set.delete(handler);
  }

  publish(event: DomainEvent): void {
    this.queue.push(event);
    void this.kick();
  }

  async whenIdle(): Promise<void> {
    while (this.drainPromise || this.queue.length > 0) {
      await (this.drainPromise ?? this.kick());
    }
  }

  private kick(): Promise<void> {
    if (!this.drainPromise) {
      this.drainPromise = this.drain().finally(() => {
        this.drainPromise = null;
      });
    }
    return this.drainPromise;
  }

  private async drain(): Promise<void> {
    while (this.queue.length > 0) {
      const event = this.queue.shift();
      if (!event) break;
      const handlers = [
        ...(this.handlers.get(event.type) ?? []),
        ...(this.handlers.get('*') ?? []),
      ];
      for (const handler of handlers) {
        await handler(event);
      }
    }
  }
}
