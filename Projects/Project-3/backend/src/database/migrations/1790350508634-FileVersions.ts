import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * File versions. Hand-edited from the generated migration in two places:
 *
 * - `datasetId` is added NULLable, filled from `id` (every existing file is version 1 of a dataset of one),
 *   and only then made NOT NULL — the generated `ADD ... NOT NULL` fails on a table that has rows.
 * - The partial index `idx_file_asset_company_live` is recreated with `AND "isLatest"`: the default list is
 *   latest-and-live, and a partial index cannot be expressed in a decorator (`synchronize: false` keeps the
 *   schema diff from proposing to drop it).
 */
export class FileVersions1790350508634 implements MigrationInterface {
    name = 'FileVersions1790350508634'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "file_asset" ADD "datasetId" uuid`);
        await queryRunner.query(`UPDATE "file_asset" SET "datasetId" = "id"`);
        await queryRunner.query(`ALTER TABLE "file_asset" ALTER COLUMN "datasetId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "file_asset" ADD "version" integer NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE "file_asset" ADD "isLatest" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`CREATE INDEX "idx_file_asset_company_dataset" ON "file_asset"  ("companyId", "datasetId") `);
        await queryRunner.query(`ALTER TABLE "file_asset" ADD CONSTRAINT "uq_file_asset_dataset_version" UNIQUE ("datasetId", "version")`);
        await queryRunner.query(`DROP INDEX "public"."idx_file_asset_company_live"`);
        await queryRunner.query(`CREATE INDEX "idx_file_asset_company_live" ON "file_asset" ("companyId", "createdAt") WHERE "deletedAt" IS NULL AND "isLatest"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_file_asset_company_live"`);
        await queryRunner.query(`CREATE INDEX "idx_file_asset_company_live" ON "file_asset" ("companyId", "createdAt") WHERE "deletedAt" IS NULL`);
        await queryRunner.query(`ALTER TABLE "file_asset" DROP CONSTRAINT "uq_file_asset_dataset_version"`);
        await queryRunner.query(`DROP INDEX "public"."idx_file_asset_company_dataset"`);
        await queryRunner.query(`ALTER TABLE "file_asset" DROP COLUMN "isLatest"`);
        await queryRunner.query(`ALTER TABLE "file_asset" DROP COLUMN "version"`);
        await queryRunner.query(`ALTER TABLE "file_asset" DROP COLUMN "datasetId"`);
    }

}
