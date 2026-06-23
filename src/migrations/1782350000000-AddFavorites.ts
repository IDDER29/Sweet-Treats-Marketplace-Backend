import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFavorites1782350000000 implements MigrationInterface {
  name = 'AddFavorites1782350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "favoriteCount" integer NOT NULL DEFAULT 0`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "favorite" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid,
        "product_id" uuid,
        CONSTRAINT "UQ_favorite_user_product" UNIQUE ("user_id", "product_id"),
        CONSTRAINT "PK_favorite" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_favorite_user" ON "favorite" ("user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorite" ADD CONSTRAINT "FK_favorite_user" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorite" ADD CONSTRAINT "FK_favorite_product" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "shop_follow" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid,
        "business_id" uuid,
        CONSTRAINT "UQ_shopfollow_user_business" UNIQUE ("user_id", "business_id"),
        CONSTRAINT "PK_shop_follow" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_shopfollow_user" ON "shop_follow" ("user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "shop_follow" ADD CONSTRAINT "FK_shopfollow_user" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "shop_follow" ADD CONSTRAINT "FK_shopfollow_business" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "shop_follow"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "favorite"`);
    await queryRunner.query(
      `ALTER TABLE "product" DROP COLUMN IF EXISTS "favoriteCount"`,
    );
  }
}
