import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFulfillmentAndTips1782380000000 implements MigrationInterface {
  name = 'AddFulfillmentAndTips1782380000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "order_fulfillmenttype_enum" AS ENUM ('PICKUP', 'DELIVERY', 'SHIPPING');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "fulfillmentType" "order_fulfillmenttype_enum" NOT NULL DEFAULT 'DELIVERY'`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "tipAmount" numeric(10,2) NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "tipAmount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "fulfillmentType"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "order_fulfillmenttype_enum"`);
  }
}
