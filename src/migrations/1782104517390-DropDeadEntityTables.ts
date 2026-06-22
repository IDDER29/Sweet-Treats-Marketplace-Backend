import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the unused snake_case "scaffolding" tables that duplicated the active
 * camelCase schema (e.g. `businesses` vs `business`, `products` vs `product`).
 * Only `users` from the original `src/entities/*` set was ever wired to code and
 * is kept. These tables carried no data (nothing ever wrote to them), so `down`
 * is intentionally a no-op rather than recreating dead schema.
 */
export class DropDeadEntityTables1782104517390 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const deadTables = [
      'order_items',
      'orders',
      'payments',
      'reviews',
      'deliveries',
      'delivery_person',
      'products',
      'business_owners',
      'businesses',
    ];
    for (const table of deadTables) {
      // CASCADE clears the FKs these dead tables had among themselves.
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
  }

  public async down(): Promise<void> {
    // No-op: the dropped tables were unused duplicates with no data. They are
    // not recreated. Restore from the InitialSchema migration history if needed.
  }
}
