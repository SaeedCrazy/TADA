import { EventEmitter } from 'node:events';
import type { OrderStatus, PaymentStatus } from '@tada/shared';

export interface OrderChanged {
  orderId: string;
  branchId: string;
  number: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  kind: 'created' | 'updated';
}

/** In-process event bus. The API runs as a single instance; swap for Postgres LISTEN/NOTIFY to scale out. */
export class EventBus {
  private ee = new EventEmitter();
  constructor() {
    this.ee.setMaxListeners(500);
  }
  emitOrder(e: OrderChanged) {
    this.ee.emit('order', e);
  }
  onOrder(fn: (e: OrderChanged) => void): () => void {
    this.ee.on('order', fn);
    return () => this.ee.off('order', fn);
  }
}
