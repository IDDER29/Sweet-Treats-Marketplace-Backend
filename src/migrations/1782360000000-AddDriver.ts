import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDriver1782360000000 implements MigrationInterface {
  name = 'AddDriver1782360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "driver" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(255) NOT NULL,
        "email" character varying(255) NOT NULL,
        "password" character varying(255) NOT NULL,
        "phone" character varying(30),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_driver_email" UNIQUE ("email"),
        CONSTRAINT "PK_driver" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "driver_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD CONSTRAINT "FK_order_driver" FOREIGN KEY ("driver_id") REFERENCES "driver"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" DROP CONSTRAINT IF EXISTS "FK_order_driver"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "driver_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "driver"`);
  }
}
