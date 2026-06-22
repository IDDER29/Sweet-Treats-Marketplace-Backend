import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexesSoftDeleteRating1782102856049 implements MigrationInterface {
    name = 'AddIndexesSoftDeleteRating1782102856049'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "deleted_at" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "business" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        // Widen rating in place so existing cached ratings are preserved
        // (rather than TypeORM's default drop-and-recreate which zeroes them).
        await queryRunner.query(`ALTER TABLE "product" ALTER COLUMN "rating" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "product" ALTER COLUMN "rating" TYPE numeric(3,2) USING "rating"::numeric(3,2)`);
        await queryRunner.query(`ALTER TABLE "product" ALTER COLUMN "rating" SET DEFAULT '0'`);
        await queryRunner.query(`CREATE INDEX "IDX_4cca40c3813d4b88a83edb459b" ON "business" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_8b95800811275dd98a888044d5" ON "product" ("businessId") `);
        await queryRunner.query(`CREATE INDEX "idx_review_product" ON "review" ("product_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_review_user_product" ON "review" ("user_id", "product_id") `);
        await queryRunner.query(`CREATE INDEX "idx_order_customer_created" ON "order" ("customer_id", "createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_order_customer_created"`);
        await queryRunner.query(`DROP INDEX "public"."idx_review_user_product"`);
        await queryRunner.query(`DROP INDEX "public"."idx_review_product"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8b95800811275dd98a888044d5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4cca40c3813d4b88a83edb459b"`);
        await queryRunner.query(`ALTER TABLE "product" ALTER COLUMN "rating" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "product" ALTER COLUMN "rating" TYPE integer USING ROUND("rating")::integer`);
        await queryRunner.query(`ALTER TABLE "product" ALTER COLUMN "rating" SET DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "business" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deleted_at"`);
    }

}
