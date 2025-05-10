import {type Cradle} from '@fastify/awilix';
import {eq} from 'drizzle-orm';
import {type INotificationService} from '../notifications.port.js';
import {products, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

export class ProductService {
	private readonly ns: INotificationService;
	private readonly db: Database;

	public constructor({ns, db}: Pick<Cradle, 'ns' | 'db'>) {
		this.ns = ns;
		this.db = db;
	}
	
	private async save(p: Product): Promise<void> {
		await this.db.update(products).set(p).where(eq(products.id, p.id));
	}

	public async notifyDelay(leadTime: number, p: Product): Promise<void> {
		p.leadTime = leadTime;
		await this.save(p);
		this.ns.sendDelayNotification(leadTime, p.name);
	}

	public async handleSeasonalProduct(p: Product): Promise<void> {
		const currentDate = new Date();
		const projectedRestockDate = new Date(currentDate.getTime() + (p.leadTime * MILLISECONDS_PER_DAY));
		
		// Check if we get more items after the season is over
		if (projectedRestockDate > p.seasonEndDate!) {
			this.ns.sendOutOfStockNotification(p.name);
			p.available = 0;
			await this.save(p);
		} else if (p.seasonStartDate! > currentDate) {
			this.ns.sendOutOfStockNotification(p.name);
			await this.save(p);
		} else {
			await this.notifyDelay(p.leadTime, p);
		}
	}

	public async handleExpiredProduct(p: Product): Promise<void> {
		const currentDate = new Date();

		// Check if product is in stock and not expired
		if (p.available > 0 && p.expiryDate! > currentDate) {
			p.available -= 1;
			await this.save(p);
		} else {
			this.ns.sendExpirationNotification(p.name, p.expiryDate!);
			p.available = 0;
			await this.save(p);
		}
	}
}
