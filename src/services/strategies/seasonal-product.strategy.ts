import { type Product } from '@/db/schema.js';
import { type ProductStrategy } from './product-strategy.interface.js';
import { type INotificationService } from '../notifications.port.js';
import { type Database } from '@/db/type.js';
import { products } from '@/db/schema.js';
import { eq } from 'drizzle-orm';

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

export class SeasonalProductStrategy implements ProductStrategy {
  constructor(
    private readonly db: Database,
    private readonly ns: INotificationService
  ) {}

  async handle(product: Product): Promise<void> {
    const currentDate = new Date();
    const projectedRestockDate = new Date(currentDate.getTime() + (product.leadTime * MILLISECONDS_PER_DAY));
    
    if (projectedRestockDate > product.seasonEndDate!) {
      this.ns.sendOutOfStockNotification(product.name);
      product.available = 0;
      await this.save(product);
    } else if (product.seasonStartDate! > currentDate) {
      this.ns.sendOutOfStockNotification(product.name);
      await this.save(product);
    } else {
      await this.notifyDelay(product.leadTime, product);
    }
  }

  private async save(product: Product): Promise<void> {
    await this.db.update(products).set(product).where(eq(products.id, product.id));
  }

  async notifyDelay(leadTime: number, product: Product): Promise<void> {
    product.leadTime = leadTime;
    await this.save(product);
    this.ns.sendDelayNotification(leadTime, product.name);
  }
}
