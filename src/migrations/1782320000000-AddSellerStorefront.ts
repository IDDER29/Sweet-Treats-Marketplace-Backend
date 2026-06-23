import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSellerStorefront1782320000000 implements MigrationInterface {
  name = 'AddSellerStorefront1782320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business" ADD COLUMN IF NOT EXISTS "slug" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "business" ADD COLUMN IF NOT EXISTS "description" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "business" ADD COLUMN IF NOT EXISTS "logoUrl" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "business" ADD COLUMN IF NOT EXISTS "bannerUrl" character varying(500)`,
    );
    await queryRunner.query(
      `ALTER TABLE "business" ADD COLUMN IF NOT EXISTS "businessHours" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "business" ADD COLUMN IF NOT EXISTS "rating" numeric(3,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "business" ADD COLUMN IF NOT EXISTS "reviewCount" integer NOT NULL DEFAULT 0`,
    );
    // Backfill a unique slug for existing businesses (name + id prefix).
    await queryRunner.query(`
      UPDATE "business"
      SET "slug" = lower(regexp_replace("businessName", '[^a-zA-Z0-9]+', '-', 'g'))
                   || '-' || substring("id"::text, 1, 8)
      WHERE "slug" IS NULL
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_business_slug" ON "business" ("slug")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_business_slug"`);
    await queryRunner.query(
      `ALTER TABLE "business" DROP COLUMN IF EXISTS "reviewCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business" DROP COLUMN IF EXISTS "rating"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business" DROP COLUMN IF EXISTS "businessHours"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business" DROP COLUMN IF EXISTS "bannerUrl"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business" DROP COLUMN IF EXISTS "logoUrl"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business" DROP COLUMN IF EXISTS "description"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business" DROP COLUMN IF EXISTS "slug"`,
    );
  }
}
