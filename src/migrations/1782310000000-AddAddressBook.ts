import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAddressBook1782310000000 implements MigrationInterface {
  name = 'AddAddressBook1782310000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "address" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "label" character varying(100),
        "recipientName" character varying(255) NOT NULL,
        "line1" character varying(255) NOT NULL,
        "line2" character varying(255),
        "city" character varying(120) NOT NULL,
        "postcode" character varying(20) NOT NULL,
        "country" character varying(2) NOT NULL DEFAULT 'GB',
        "phone" character varying(30),
        "isDefault" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid,
        CONSTRAINT "PK_address" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_address_user" ON "address" ("user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "address" ADD CONSTRAINT "FK_address_user" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE`,
    );

    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "deliveryAddressId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "contactPhone" character varying(30)`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "giftMessage" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "giftMessage"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "contactPhone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order" DROP COLUMN IF EXISTS "deliveryAddressId"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "address"`);
  }
}
