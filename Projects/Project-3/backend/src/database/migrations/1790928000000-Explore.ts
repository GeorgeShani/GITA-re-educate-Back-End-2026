import { MigrationInterface, QueryRunner } from 'typeorm';

/** Questions asked of a file in plain language, counted against the plan. */
export class Explore1790928000000 implements MigrationInterface {
  name = 'Explore1790928000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ask_event" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "companyId" uuid NOT NULL, "fileId" uuid NOT NULL, "userId" uuid, CONSTRAINT "PK_ask_event" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "idx_ask_event_company_time" ON "ask_event" ("companyId", "createdAt")`);
    await queryRunner.query(
      `ALTER TABLE "ask_event" ADD CONSTRAINT "FK_f0689c8ebf50b2d0ef37ed8eb0f" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "ask_event" DROP CONSTRAINT "FK_f0689c8ebf50b2d0ef37ed8eb0f"`);
    await queryRunner.query(`DROP INDEX "public"."idx_ask_event_company_time"`);
    await queryRunner.query(`DROP TABLE "ask_event"`);
  }
}
