import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCart1782300000000 implements MigrationInterface {
  name = 'AddCart1782300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cart" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid,
        CONSTRAINT "PK_cart" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_cart_user" ON "cart" ("user_id")`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cart_item" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "quantity" integer NOT NULL DEFAULT 1,
        "cart_id" uuid,
        "product_id" uuid,
        CONSTRAINT "UQ_cart_item_cart_product" UNIQUE ("cart_id", "product_id"),
        CONSTRAINT "PK_cart_item" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "cart" ADD CONSTRAINT "FK_cart_user" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_item" ADD CONSTRAINT "FK_cart_item_cart" FOREIGN KEY ("cart_id") REFERENCES "cart"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "cart_item" ADD CONSTRAINT "FK_cart_item_product" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cart_item"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cart_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cart"`);
  }
}
