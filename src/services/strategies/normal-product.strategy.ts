import { type Product } from '@/db/schema.js';
import { type ProductStrategy } from './product-strategy.interface.js';
import { type INotificationService } from '../notifications.port.js';
import { type Database } from '@/db/type.js';
import { products } from '@/db/schema.js';
import { eq } from 'drizzle-orm';

export class NormalProductStrategy implements ProductStrategy {
  constructor(
    private readonly db: Database,
    private readonly ns: INotificationService
  ) {}

  async handle(_product: Product): Promise<void> {
    // Normal products don't require special handling
    // This is a placeholder for future normal product logic
  }

  async notifyDelay(leadTime: number, product: Product): Promise<void> {
    product.leadTime = leadTime;
    await this.db.update(products).set(product).where(eq(products.id, product.id));
    this.ns.sendDelayNotification(leadTime, product.name);
  }
}
