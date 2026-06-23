import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessaging1782370000000 implements MigrationInterface {
  name = 'AddMessaging1782370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "conversation" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "lastMessageAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "customer_id" uuid,
        "business_id" uuid,
        CONSTRAINT "UQ_conversation_customer_business" UNIQUE ("customer_id", "business_id"),
        CONSTRAINT "PK_conversation" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "conversation" ADD CONSTRAINT "FK_conversation_customer" FOREIGN KEY ("customer_id") REFERENCES "users"("user_id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation" ADD CONSTRAINT "FK_conversation_business" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "message" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "senderType" character varying(10) NOT NULL,
        "body" text NOT NULL,
        "readAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "conversation_id" uuid,
        CONSTRAINT "PK_message" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_message_conversation_created" ON "message" ("conversation_id", "createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "message" ADD CONSTRAINT "FK_message_conversation" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "message"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "conversation"`);
  }
}
