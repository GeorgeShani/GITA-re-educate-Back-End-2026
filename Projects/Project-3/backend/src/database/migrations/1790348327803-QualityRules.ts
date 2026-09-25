import { MigrationInterface, QueryRunner } from "typeorm";

export class QualityRules1790348327803 implements MigrationInterface {
    name = 'QualityRules1790348327803'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "quality_rule" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "companyId" uuid NOT NULL, "name" text NOT NULL, "columnName" text, "kind" text NOT NULL, "params" jsonb NOT NULL, "severity" text NOT NULL, "enabled" boolean NOT NULL DEFAULT true, "createdByUserId" uuid NOT NULL, CONSTRAINT "PK_5e81e35803652b2d5a0ba92f46e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_quality_rule_company" ON "quality_rule"  ("companyId", "createdAt") `);
        await queryRunner.query(`ALTER TABLE "data_quality_report" ADD "ruleResults" jsonb`);
        await queryRunner.query(`ALTER TABLE "data_quality_report" ADD "qualityScore" integer`);
        await queryRunner.query(`ALTER TABLE "quality_rule" ADD CONSTRAINT "FK_3f9e233a5b138bbc23ac2a56349" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "quality_rule" ADD CONSTRAINT "FK_c7541c35d93413ce3b18025173f" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quality_rule" DROP CONSTRAINT "FK_c7541c35d93413ce3b18025173f"`);
        await queryRunner.query(`ALTER TABLE "quality_rule" DROP CONSTRAINT "FK_3f9e233a5b138bbc23ac2a56349"`);
        await queryRunner.query(`ALTER TABLE "data_quality_report" DROP COLUMN "qualityScore"`);
        await queryRunner.query(`ALTER TABLE "data_quality_report" DROP COLUMN "ruleResults"`);
        await queryRunner.query(`DROP INDEX "public"."idx_quality_rule_company"`);
        await queryRunner.query(`DROP TABLE "quality_rule"`);
    }

}
