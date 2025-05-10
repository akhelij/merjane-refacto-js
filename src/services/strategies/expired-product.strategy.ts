import { type Product } from '@/db/schema.js';
import { type ProductStrategy } from './product-strategy.interface.js';
import { type INotificationService } from '../notifications.port.js';
import { type Database } from '@/db/type.js';
import { products } from '@/db/schema.js';
import { eq } from 'drizzle-orm';

export class ExpiredProductStrategy implements ProductStrategy {
  constructor(
    private readonly db: Database,
    private readonly ns: INotificationService
  ) {}

  async handle(product: Product): Promise<void> {
    const currentDate = new Date();

    if (product.available > 0 && product.expiryDate! > currentDate) {
      product.available -= 1;
      await this.save(product);
    } else {
      this.ns.sendExpirationNotification(product.name, product.expiryDate!);
      product.available = 0;
      await this.save(product);
    }
  }

  private async save(product: Product): Promise<void> {
    await this.db.update(products).set(product).where(eq(products.id, product.id));
  }
}
