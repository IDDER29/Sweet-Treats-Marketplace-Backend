import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReviewExtras1782340000000 implements MigrationInterface {
  name = 'AddReviewExtras1782340000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "images" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "verifiedPurchase" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "sellerReply" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "review" ADD COLUMN IF NOT EXISTS "sellerRepliedAt" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "review" DROP COLUMN IF EXISTS "sellerRepliedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "review" DROP COLUMN IF EXISTS "sellerReply"`,
    );
    await queryRunner.query(
      `ALTER TABLE "review" DROP COLUMN IF EXISTS "verifiedPurchase"`,
    );
    await queryRunner.query(
      `ALTER TABLE "review" DROP COLUMN IF EXISTS "images"`,
    );
  }
}
