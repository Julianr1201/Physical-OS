import { randomUUID } from 'node:crypto';
import { CommerceError } from './errors.js';

export interface InventoryReservation {
  id: string;
  sku: string;
  qty: number;
  status: 'held' | 'committed' | 'released';
}

export class Inventory {
  private readonly stock = new Map<string, number>();
  private readonly reservations = new Map<string, InventoryReservation>();

  constructor(opening: Array<{ sku: string; qty: number }>) {
    for (const item of opening) this.stock.set(item.sku, item.qty);
  }

  available(sku: string): number {
    return this.stock.get(sku) ?? 0;
  }

  reserve(sku: string, qty: number): InventoryReservation {
    const left = this.available(sku);
    if (left < qty) throw new CommerceError('out_of_stock', 'Not enough items in the dispenser.', 409);
    this.stock.set(sku, left - qty);
    const reservation: InventoryReservation = { id: randomUUID(), sku, qty, status: 'held' };
    this.reservations.set(reservation.id, reservation);
    return reservation;
  }

  commit(id: string): void {
    const reservation = this.require(id);
    if (reservation.status === 'committed') return;
    if (reservation.status !== 'held') throw new CommerceError('reservation_closed', 'That reservation is closed.', 409);
    reservation.status = 'committed';
  }

  release(id: string): void {
    const reservation = this.require(id);
    if (reservation.status === 'released') return;
    if (reservation.status === 'committed') return;
    this.stock.set(reservation.sku, this.available(reservation.sku) + reservation.qty);
    reservation.status = 'released';
  }

  private require(id: string): InventoryReservation {
    const reservation = this.reservations.get(id);
    if (!reservation) throw new CommerceError('unknown_reservation', 'Reservation not found.', 404);
    return reservation;
  }
}
