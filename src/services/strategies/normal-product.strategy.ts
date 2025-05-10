import { type Product } from '@/db/schema.js';
import { type ProductStrategy } from './product-strategy.interface.js';

export class NormalProductStrategy implements ProductStrategy {
  constructor(
  ) {}

  async handle(_product: Product): Promise<void> {
    // Normal products don't require special handling in this iteration.
  }
}
