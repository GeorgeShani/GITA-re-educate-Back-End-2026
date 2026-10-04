import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cleaning: a file can be rewritten as the next version of its dataset by a recipe of small steps. Adds the job that tracks one
 * such request, the per-dataset settings (saved recipe, "clean every new version", key columns), where a version came from, and
 * the background task that does the work.
 */
export class Cleaning1790755200000 implements MigrationInterface {
  name = 'Cleaning1790755200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."background_task_type" ADD VALUE 'apply_cleaning_recipe'`,
    );
    await queryRunner.query(
      `CREATE TABLE "cleaning_job" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "companyId" uuid NOT NULL, "fileId" uuid NOT NULL, "requestedByUserId" uuid NOT NULL, "trigger" text NOT NULL, "recipe" jsonb NOT NULL, "sheet" text, "status" text NOT NULL DEFAULT 'queued', "resultFileId" uuid, "steps" jsonb, "rowsBefore" integer, "rowsAfter" integer, "errorMessage" text, CONSTRAINT "PK_cleaning_job" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "idx_cleaning_job_company" ON "cleaning_job" ("companyId", "createdAt")`);
    await queryRunner.query(`CREATE INDEX "idx_cleaning_job_file" ON "cleaning_job" ("fileId")`);
    await queryRunner.query(
      `ALTER TABLE "cleaning_job" ADD CONSTRAINT "FK_ad117ab7ed77dba44b43ac9dd7d" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE TABLE "dataset_settings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "companyId" uuid NOT NULL, "datasetId" uuid NOT NULL, "keyColumns" jsonb NOT NULL DEFAULT '[]', "recipe" jsonb, "autoClean" boolean NOT NULL DEFAULT false, "updatedByUserId" uuid, CONSTRAINT "PK_dataset_settings" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_dataset_settings_dataset" ON "dataset_settings" ("companyId", "datasetId")`);
    await queryRunner.query(
      `ALTER TABLE "dataset_settings" ADD CONSTRAINT "FK_12fad1de95b6a29e172d06a3049" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "file_asset" ADD "derivedFromFileId" uuid`);
    await queryRunner.query(`ALTER TABLE "file_asset" ADD "derivation" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "file_asset" DROP COLUMN "derivation"`);
    await queryRunner.query(`ALTER TABLE "file_asset" DROP COLUMN "derivedFromFileId"`);
    await queryRunner.query(`ALTER TABLE "dataset_settings" DROP CONSTRAINT "FK_12fad1de95b6a29e172d06a3049"`);
    await queryRunner.query(`DROP INDEX "public"."uq_dataset_settings_dataset"`);
    await queryRunner.query(`DROP TABLE "dataset_settings"`);
    await queryRunner.query(`ALTER TABLE "cleaning_job" DROP CONSTRAINT "FK_ad117ab7ed77dba44b43ac9dd7d"`);
    await queryRunner.query(`DROP INDEX "public"."idx_cleaning_job_file"`);
    await queryRunner.query(`DROP INDEX "public"."idx_cleaning_job_company"`);
    await queryRunner.query(`DROP TABLE "cleaning_job"`);
    await queryRunner.query(`DELETE FROM "background_task" WHERE "type" = 'apply_cleaning_recipe'`);
    await queryRunner.query(
      `CREATE TYPE "public"."background_task_type_old" AS ENUM('send_email', 'build_data_quality_report', 'sync_stripe_seats', 'report_stripe_usage', 'deliver_webhook', 'cancel_stripe_subscription')`,
    );
    await queryRunner.query(
      `ALTER TABLE "background_task" ALTER COLUMN "type" TYPE "public"."background_task_type_old" USING "type"::"text"::"public"."background_task_type_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."background_task_type"`);
    await queryRunner.query(`ALTER TYPE "public"."background_task_type_old" RENAME TO "background_task_type"`);
  }
}
