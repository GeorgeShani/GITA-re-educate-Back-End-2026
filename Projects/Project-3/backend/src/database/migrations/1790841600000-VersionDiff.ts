import { MigrationInterface, QueryRunner } from 'typeorm';

/** The row-level comparison of two versions: its table and the background task that builds it. */
export class VersionDiff1790841600000 implements MigrationInterface {
  name = 'VersionDiff1790841600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."background_task_type" ADD VALUE 'build_version_diff'`);
    await queryRunner.query(
      `CREATE TABLE "version_diff" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "companyId" uuid NOT NULL, "fromFileId" uuid NOT NULL, "toFileId" uuid NOT NULL, "keyColumns" jsonb NOT NULL, "trigger" text NOT NULL, "status" text NOT NULL DEFAULT 'queued', "summary" jsonb, "sample" jsonb, "errorMessage" text, CONSTRAINT "PK_version_diff" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_version_diff_pair" ON "version_diff" ("companyId", "fromFileId", "toFileId")`);
    await queryRunner.query(
      `ALTER TABLE "version_diff" ADD CONSTRAINT "FK_6f09e6cd2990af82b1bb5bb7b08" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "version_diff" DROP CONSTRAINT "FK_6f09e6cd2990af82b1bb5bb7b08"`);
    await queryRunner.query(`DROP INDEX "public"."uq_version_diff_pair"`);
    await queryRunner.query(`DROP TABLE "version_diff"`);
  }
}
