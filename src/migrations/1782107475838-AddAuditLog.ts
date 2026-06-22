import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditLog1782107475838 implements MigrationInterface {
    name = 'AddAuditLog1782107475838'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "audit_log" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actorId" uuid, "actorRole" character varying(50), "action" character varying(100) NOT NULL, "resourceType" character varying(100) NOT NULL, "resourceId" character varying(100), "metadata" jsonb, "ip" character varying(64), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_07fefa57f7f5ab8fc3f52b3ed0b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_audit_actor_created" ON "audit_log" ("actorId", "createdAt") `);
        await queryRunner.query(`CREATE INDEX "idx_audit_resource" ON "audit_log" ("resourceType", "resourceId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_audit_resource"`);
        await queryRunner.query(`DROP INDEX "public"."idx_audit_actor_created"`);
        await queryRunner.query(`DROP TABLE "audit_log"`);
    }

}
