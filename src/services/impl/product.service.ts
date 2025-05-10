import {type Cradle} from '@fastify/awilix';
import {eq} from 'drizzle-orm';
import {type INotificationService} from '../notifications.port.js';
import {products, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';
import {ProductStrategyFactory} from '../strategies/product-strategy.factory.js';

export class ProductService {
	private readonly ns: INotificationService;
	private readonly db: Database;
	private readonly strategyFactory: ProductStrategyFactory;

	public constructor({ns, db}: Pick<Cradle, 'ns' | 'db'>) {
		this.ns = ns;
		this.db = db;
		this.strategyFactory = new ProductStrategyFactory(db, ns);
	}
	
	private async save(p: Product): Promise<void> {
		await this.db.update(products).set(p).where(eq(products.id, p.id));
	}

	public async notifyDelay(leadTime: number, p: Product): Promise<void> {
		p.leadTime = leadTime;
		await this.save(p);
		this.ns.sendDelayNotification(leadTime, p.name);
	}

	public async handleProduct(p: Product): Promise<void> {
		const strategy = this.strategyFactory.getStrategy(p);
		await strategy.handle(p);
	}

	public async handleSeasonalProduct(p: Product): Promise<void> {
		const strategy = this.strategyFactory.getStrategy(p);
		await strategy.handle(p);
	}

	public async handleExpiredProduct(p: Product): Promise<void> {
		const strategy = this.strategyFactory.getStrategy(p);
		await strategy.handle(p);
	}
}
