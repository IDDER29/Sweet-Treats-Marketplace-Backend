import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStripeConnectToBusiness1782250000000
  implements MigrationInterface
{
  name = 'AddStripeConnectToBusiness1782250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business" ADD COLUMN IF NOT EXISTS "stripeAccountId" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "business" ADD COLUMN IF NOT EXISTS "payoutsEnabled" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business" DROP COLUMN IF EXISTS "payoutsEnabled"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business" DROP COLUMN IF EXISTS "stripeAccountId"`,
    );
  }
}
