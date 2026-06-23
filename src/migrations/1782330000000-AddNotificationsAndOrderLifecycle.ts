import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationsAndOrderLifecycle1782330000000
  implements MigrationInterface
{
  name = 'AddNotificationsAndOrderLifecycle1782330000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // New order-lifecycle statuses (PG16 allows ADD VALUE inside a transaction).
    await queryRunner.query(
      `ALTER TYPE "order_status_enum" ADD VALUE IF NOT EXISTS 'PREPARING'`,
    );
    await queryRunner.query(
      `ALTER TYPE "order_status_enum" ADD VALUE IF NOT EXISTS 'READY'`,
    );
    await queryRunner.query(
      `ALTER TYPE "order_status_enum" ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY'`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" character varying(50) NOT NULL,
        "title" character varying(255) NOT NULL,
        "body" text,
        "data" jsonb,
        "readAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "user_id" uuid,
        CONSTRAINT "PK_notification" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_notification_user_created" ON "notification" ("user_id", "createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "notification" ADD CONSTRAINT "FK_notification_user" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notification"`);
    // Enum values are not removed (Postgres can't DROP an enum value); harmless.
  }
}
