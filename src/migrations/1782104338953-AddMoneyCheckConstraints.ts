import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMoneyCheckConstraints1782104338953 implements MigrationInterface {
    name = 'AddMoneyCheckConstraints1782104338953'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product" ADD CONSTRAINT "CHK_product_price_nonneg" CHECK ("price" >= 0)`);
        await queryRunner.query(`ALTER TABLE "order" ADD CONSTRAINT "CHK_order_total_nonneg" CHECK ("totalAmount" >= 0)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "order" DROP CONSTRAINT "CHK_order_total_nonneg"`);
        await queryRunner.query(`ALTER TABLE "product" DROP CONSTRAINT "CHK_product_price_nonneg"`);
    }

}
