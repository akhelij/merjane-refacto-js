import { type Product } from '@/db/schema.js';
import { type ProductStrategy } from './product-strategy.interface.js';
import { type INotificationService } from '../notifications.port.js';
import dayjs from 'dayjs';

export class SeasonalProductStrategy implements ProductStrategy {
  constructor(
    private readonly ns: INotificationService
  ) {}

  async handle(product: Product): Promise<void> {
    const currentDate = dayjs();
    const projectedRestockDate = currentDate.add(product.leadTime, 'day');
    
    const seasonEndDate = product.seasonEndDate ? dayjs(product.seasonEndDate) : null;
    const seasonStartDate = product.seasonStartDate ? dayjs(product.seasonStartDate) : null;

    if (seasonEndDate && projectedRestockDate.isAfter(seasonEndDate)) {
      this.ns.sendOutOfStockNotification(product.name);
      product.available = 0;
    } else if (seasonStartDate && seasonStartDate.isAfter(currentDate)) {
      this.ns.sendOutOfStockNotification(product.name);
    } else {
      await this.notifyDelay(product.leadTime, product);
    }
  }

  async notifyDelay(leadTime: number, product: Product): Promise<void> {
    product.leadTime = leadTime;
    this.ns.sendDelayNotification(leadTime, product.name);
  }
}
