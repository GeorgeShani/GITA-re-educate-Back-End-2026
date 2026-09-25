import { MigrationInterface, QueryRunner } from "typeorm";

export class DataQualityReports1790284381430 implements MigrationInterface {
    name = 'DataQualityReports1790284381430'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."data_quality_report_status" AS ENUM('queued', 'profiling', 'ready', 'unsupported', 'failed')`);
        await queryRunner.query(`CREATE TABLE "data_quality_report" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "fileId" uuid NOT NULL, "companyId" uuid NOT NULL, "status" "public"."data_quality_report_status" NOT NULL DEFAULT 'queued', "metrics" jsonb, "summaryText" text, "recommendations" jsonb, "model" text, "errorMessage" text, "previewRows" jsonb, "profiledAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_472a35a98149b1df6f1dd6fe922" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5038a9edad17a007cebfa62acd" ON "data_quality_report"  ("fileId") `);
        await queryRunner.query(`CREATE INDEX "idx_data_quality_report_company_status" ON "data_quality_report"  ("companyId", "status") `);
        await queryRunner.query(`ALTER TABLE "data_quality_report" ADD CONSTRAINT "FK_5038a9edad17a007cebfa62acdf" FOREIGN KEY ("fileId") REFERENCES "file_asset"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "data_quality_report" ADD CONSTRAINT "FK_adad5816eb8569d0de4569bf33c" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "data_quality_report" DROP CONSTRAINT "FK_adad5816eb8569d0de4569bf33c"`);
        await queryRunner.query(`ALTER TABLE "data_quality_report" DROP CONSTRAINT "FK_5038a9edad17a007cebfa62acdf"`);
        await queryRunner.query(`DROP INDEX "public"."idx_data_quality_report_company_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5038a9edad17a007cebfa62acd"`);
        await queryRunner.query(`DROP TABLE "data_quality_report"`);
        await queryRunner.query(`DROP TYPE "public"."data_quality_report_status"`);
    }

}
