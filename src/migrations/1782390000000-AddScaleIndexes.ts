import { MigrationInterface, QueryRunner } from 'typeorm';

// Indexes backing list queries added during the marketplace build:
// - findForDriver() filters orders by driver_id.
// - The seller messaging list filters conversations by business_id.
//
// The customer messaging list filters by customer_id, but that is already the
// leading column of the composite UNIQUE(customer_id, business_id) index, so it
// needs no separate index. business_id is the *trailing* column of that unique
// index and is not efficiently covered, hence the dedicated index below.
export class AddScaleIndexes1782390000000 implements MigrationInterface {
  name = 'AddScaleIndexes1782390000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_order_driver" ON "order" ("driver_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_conversation_business" ON "conversation" ("business_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_conversation_business"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_order_driver"`);
  }
}
