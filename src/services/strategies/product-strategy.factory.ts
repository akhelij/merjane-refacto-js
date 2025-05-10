import { type Product } from '@/db/schema.js';
import { type ProductStrategy } from './product-strategy.interface.js';
import { NormalProductStrategy } from './normal-product.strategy.js';
import { SeasonalProductStrategy } from './seasonal-product.strategy.js';
import { ExpiredProductStrategy } from './expired-product.strategy.js';
import { type INotificationService } from '../notifications.port.js';
import { type Database } from '@/db/type.js';

export class ProductStrategyFactory {
  constructor(
    private readonly db: Database,
    private readonly ns: INotificationService
  ) {}

  getStrategy(product: Product): ProductStrategy {
    switch (product.type) {
      case 'SEASONAL':
        return new SeasonalProductStrategy(this.db, this.ns);
      case 'EXPIRABLE':
        return new ExpiredProductStrategy(this.db, this.ns);
      case 'NORMAL':
      default:
        return new NormalProductStrategy(this.db, this.ns);
    }
  }
}
