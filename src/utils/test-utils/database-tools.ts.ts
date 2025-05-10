import {rm} from 'node:fs/promises';
import {exec as execCallback} from 'node:child_process';
import {promisify} from 'node:util';
import SqliteDatabase from 'better-sqlite3';
import {drizzle} from 'drizzle-orm/better-sqlite3';
import {
	uniqueNamesGenerator, adjectives, colors, animals,
} from 'unique-names-generator';
import fg from 'fast-glob';
import * as schema from '@/db/schema.js';

const exec = promisify(execCallback);

export const UNIT_TEST_DB_PREFIX = './unit-test-';

export async function cleanAllLooseDatabases(prefix: string) {
	const entries = await fg([`${prefix}*.db`]);
	await Promise.all(entries.map(async entry => cleanUp(entry)));
}

export async function cleanUp(databaseName: string) {
	try {
		// Add a longer delay to ensure the connection has time to close
		await new Promise(resolve => setTimeout(resolve, 1000));
		await rm(databaseName, {force: true});
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.warn(`Could not remove database file ${databaseName}: ${errorMessage}`);
		// Rather than failing the test, just log the warning
	}
}

export async function createDatabaseMock() {
	const randomName = uniqueNamesGenerator({dictionaries: [adjectives, colors, animals]}); // Big_red_donkey
	const databaseName = `${UNIT_TEST_DB_PREFIX}${randomName}.db`;
	const sqlite = new SqliteDatabase(databaseName);
	// Use corepack to ensure the correct pnpm version is used
	await exec(`corepack enable pnpm && pnpm drizzle-kit push --schema=src/db/schema.ts --dialect=sqlite --url=${databaseName}`);

	const databaseMock = drizzle(sqlite, {
		schema,
	});
	return {databaseMock, databaseName};
}
