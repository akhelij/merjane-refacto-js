import { type Product } from '@/db/schema.js';
import { type ProductStrategy } from './product-strategy.interface.js';
import { type INotificationService } from '../notifications.port.js';
import dayjs from 'dayjs';

export class ExpiredProductStrategy implements ProductStrategy {
  constructor(
    private readonly ns: INotificationService
  ) {}

  async handle(product: Product): Promise<void> {
    const currentDate = dayjs();

    if (product.available > 0 && product.expiryDate && dayjs(product.expiryDate).isAfter(currentDate)) {
      product.available -= 1;
    } else {
      this.ns.sendExpirationNotification(product.name, product.expiryDate!);
      product.available = 0;
    }
  }
}
