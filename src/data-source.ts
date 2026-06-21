import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * Standalone TypeORM DataSource for the TypeORM CLI (migration generate/run/revert).
 *
 * The NestJS runtime config lives in app.module.ts; this file mirrors the same
 * connection settings but is consumed only by the `typeorm` CLI. Entities and
 * migrations are referenced via globs so new files are picked up automatically.
 *
 * Usage (see package.json scripts):
 *   npm run migration:generate -- src/migrations/SomeName
 *   npm run migration:run
 *   npm run migration:revert
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});
