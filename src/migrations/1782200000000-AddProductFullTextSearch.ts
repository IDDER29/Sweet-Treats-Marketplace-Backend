import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductFullTextSearch1782200000000
  implements MigrationInterface
{
  name = 'AddProductFullTextSearch1782200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // GIN index on the weighted tsvector that ProductService.findAll searches
    // (ProductService.FTS_DOC). Postgres matches on the parsed expression tree,
    // so the `product.` alias in the query vs. bare columns here is irrelevant —
    // only the structure must match (same functions/args/weights/order).
    //
    // NB: plain CREATE INDEX briefly locks writes; for a large live table prefer
    // CREATE INDEX CONCURRENTLY (which cannot run inside this migration's
    // transaction — run it as a separate, non-transactional step).
    await queryRunner.query(`
      CREATE INDEX "IDX_product_fts" ON "product" USING gin (
        (
          setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
          setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
          setweight(to_tsvector('english', coalesce("ingredients", '')), 'C')
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_product_fts"`);
  }
}
