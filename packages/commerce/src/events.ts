export interface CommerceEvent {
  id: string;
  at: string;
  orderId: string;
  type: string;
  detail: string;
}

export class EventLog {
  readonly records: CommerceEvent[] = [];

  add(event: CommerceEvent): void {
    this.records.push(event);
  }

  forOrder(orderId: string): CommerceEvent[] {
    return this.records.filter((event) => event.orderId === orderId);
  }
}
