import { type Product } from '@/db/schema.js';

/**
 * Strategy interface for handling different product types
 */
export interface ProductStrategy {
  handle(product: Product): Promise<void>;
}
