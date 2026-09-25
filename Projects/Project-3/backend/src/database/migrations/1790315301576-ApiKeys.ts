import { MigrationInterface, QueryRunner } from "typeorm";

export class ApiKeys1790315301576 implements MigrationInterface {
    name = 'ApiKeys1790315301576'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "api_key" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "companyId" uuid NOT NULL, "createdByUserId" uuid NOT NULL, "name" text NOT NULL, "prefix" text NOT NULL, "keyHash" text NOT NULL, "scopes" text array NOT NULL, "lastUsedAt" TIMESTAMP WITH TIME ZONE, "revokedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_b1bd840641b8acbaad89c3d8d11" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4aacb7c1641a74534c8a96c4dc" ON "api_key"  ("keyHash") `);
        await queryRunner.query(`CREATE INDEX "idx_api_key_company_creator" ON "api_key"  ("companyId", "createdByUserId") `);
        await queryRunner.query(`CREATE INDEX "idx_api_key_company_created" ON "api_key"  ("companyId", "createdAt") `);
        await queryRunner.query(`ALTER TABLE "api_key" ADD CONSTRAINT "FK_28251866b7f25008822bd735724" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "api_key" ADD CONSTRAINT "FK_581f7fd10a2afeb51c998e3f32b" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "api_key" DROP CONSTRAINT "FK_581f7fd10a2afeb51c998e3f32b"`);
        await queryRunner.query(`ALTER TABLE "api_key" DROP CONSTRAINT "FK_28251866b7f25008822bd735724"`);
        await queryRunner.query(`DROP INDEX "public"."idx_api_key_company_created"`);
        await queryRunner.query(`DROP INDEX "public"."idx_api_key_company_creator"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4aacb7c1641a74534c8a96c4dc"`);
        await queryRunner.query(`DROP TABLE "api_key"`);
    }

}
