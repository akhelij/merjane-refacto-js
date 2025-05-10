import {
	describe, it, expect, beforeEach,
	afterEach,
} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {type INotificationService} from '../notifications.port.js';
import {createDatabaseMock, cleanUp} from '../../utils/test-utils/database-tools.ts.js';
import {ProductService} from './product.service.js';
import {products, type Product} from '@/db/schema.js';
import {type Database} from '@/db/type.js';

describe('ProductService Tests', () => {
	let notificationServiceMock: DeepMockProxy<INotificationService>;
	let productService: ProductService;
	let databaseMock: Database;
	let databaseName: string;

	beforeEach(async () => {
		({databaseMock, databaseName} = await createDatabaseMock());
		notificationServiceMock = mockDeep<INotificationService>();
		productService = new ProductService({
			ns: notificationServiceMock,
			db: databaseMock,
		});
	});

	afterEach(async () => cleanUp(databaseName));

	it('should handle delay notification correctly', async () => {
		// GIVEN
		const product: Product = {
			id: 1,
			leadTime: 15,
			available: 0,
			type: 'NORMAL',
			name: 'RJ45 Cable',
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
		};
		await databaseMock.insert(products).values(product);

		// WHEN
		await productService.notifyDelay(product.leadTime, product);

		// THEN
		expect(product.available).toBe(0);
		expect(product.leadTime).toBe(15);
		expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(product.leadTime, product.name);
		const result = await databaseMock.query.products.findFirst({
			where: (product, {eq}) => eq(product.id, product.id),
		});
		expect(result).toEqual(product);
	});

	describe('handleSeasonalProduct', () => {
		const oneDayInMs = 1000 * 60 * 60 * 24;

		it('should notify delay when product is in-season and lead time is within season', async () => {
			// GIVEN
			const currentDate = new Date();
			const seasonStartDate = new Date(currentDate.getTime() - 10 * oneDayInMs);
			const seasonEndDate = new Date(currentDate.getTime() + 30 * oneDayInMs);
			const product: Product = {
				id: 1,
				leadTime: 5,
				available: 0,
				type: 'SEASONAL',
				name: 'Product1',
				expiryDate: null,
				seasonStartDate,
				seasonEndDate,
			};
			await databaseMock.insert(products).values(product);

			// WHEN
			await productService.handleProductUpdate(product);

			// THEN
			expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(product.leadTime, product.name);
			expect(notificationServiceMock.sendOutOfStockNotification).not.toHaveBeenCalled();
			expect(notificationServiceMock.sendExpirationNotification).not.toHaveBeenCalled();
			const result = await databaseMock.query.products.findFirst({
				where: (p, {eq}) => eq(p.id, product.id),
			});
			expect(result).toEqual(product);
		});

		it('should send out of stock notification when product is in-season but lead time extends beyond season', async () => {
			// GIVEN
			const currentDate = new Date();
			const seasonStartDate = new Date(currentDate.getTime() - 10 * oneDayInMs);
			const seasonEndDate = new Date(currentDate.getTime() + 10 * oneDayInMs);
			const product: Product = {
				id: 1,
				leadTime: 15,
				available: 0,
				type: 'SEASONAL',
				name: 'Product1',
				expiryDate: null,
				seasonStartDate,
				seasonEndDate,
			};
			await databaseMock.insert(products).values(product);

			// WHEN
			await productService.handleProductUpdate(product);

			// THEN
			expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith(product.name);
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
			expect(notificationServiceMock.sendExpirationNotification).not.toHaveBeenCalled();
			expect(product.available).toBe(0);
			const result = await databaseMock.query.products.findFirst({
				where: (p, {eq}) => eq(p.id, product.id),
			});
			expect(result).toEqual(product);
		});

		it('should send out of stock notification when current date is before season start', async () => {
			// GIVEN
			const currentDate = new Date();
			const seasonStartDate = new Date(currentDate.getTime() + 15 * oneDayInMs);
			const seasonEndDate = new Date(currentDate.getTime() + 45 * oneDayInMs);
			const product: Product = {
				id: 1,
				leadTime: 5,
				available: 0,
				type: 'SEASONAL',
				name: 'Product1',
				expiryDate: null,
				seasonStartDate,
				seasonEndDate,
			};
			await databaseMock.insert(products).values(product);

			// WHEN
			await productService.handleProductUpdate(product);

			// THEN
			expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith(product.name);
			expect(notificationServiceMock.sendDelayNotification).not.toHaveBeenCalled();
			expect(notificationServiceMock.sendExpirationNotification).not.toHaveBeenCalled();
			const result = await databaseMock.query.products.findFirst({
				where: (p, {eq}) => eq(p.id, product.id),
			});
			expect(result).toEqual(product);
		});
	});

	describe('handleExpiredProduct', () => {
		const oneDayInMs = 1000 * 60 * 60 * 24;

		it('should decrement available when product is not expired and available > 0', async () => {
			// GIVEN
			const currentDate = new Date();
			const expiryDate = new Date(currentDate.getTime() + 10 * oneDayInMs); // 10 days in future
			const product: Product = {
				id: 1,
				leadTime: 5,
				available: 10, // Available stock
				type: 'EXPIRABLE',
				name: 'Product1',
				expiryDate,
				seasonStartDate: null,
				seasonEndDate: null,
			};
			await databaseMock.insert(products).values(product);

			// WHEN
			await productService.handleProductUpdate(product);

			// THEN
			expect(product.available).toBe(9); // Should be decremented
			expect(notificationServiceMock.sendExpirationNotification).not.toHaveBeenCalled();
			const result = await databaseMock.query.products.findFirst({
				where: (p, {eq}) => eq(p.id, product.id),
			});
			expect(result).toEqual(product);
		});

		it('should set available to 0 and send expiration notification when product is expired and available > 0', async () => {
			// GIVEN
			const currentDate = new Date();
			const expiryDate = new Date(currentDate.getTime() - 5 * oneDayInMs); // 5 days ago (expired)
			const product: Product = {
				id: 1,
				leadTime: 5,
				available: 10, // Available stock but expired
				type: 'EXPIRABLE',
				name: 'Product1',
				expiryDate,
				seasonStartDate: null,
				seasonEndDate: null,
			};
			await databaseMock.insert(products).values(product);

			// WHEN
			await productService.handleProductUpdate(product);

			// THEN
			expect(product.available).toBe(0); // Should be set to 0
			expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalledWith(product.name, product.expiryDate);
			const result = await databaseMock.query.products.findFirst({
				where: (p, {eq}) => eq(p.id, product.id),
			});
			expect(result).toEqual(product);
		});

		it('should set available to 0 and send expiration notification when product is not expired but available = 0', async () => {
			// GIVEN
			const currentDate = new Date();
			const expiryDate = new Date(currentDate.getTime() + 10 * oneDayInMs); // 10 days in future
			const product: Product = {
				id: 1,
				leadTime: 5,
				available: 0, // No stock
				type: 'EXPIRABLE',
				name: 'Product1',
				expiryDate,
				seasonStartDate: null,
				seasonEndDate: null,
			};
			await databaseMock.insert(products).values(product);

			// WHEN
			await productService.handleProductUpdate(product);

			// THEN
			expect(product.available).toBe(0); // Should remain 0
			expect(notificationServiceMock.sendExpirationNotification).toHaveBeenCalledWith(product.name, product.expiryDate);
			const result = await databaseMock.query.products.findFirst({
				where: (p, {eq}) => eq(p.id, product.id),
			});
			expect(result).toEqual(product);
		});
	});
});
