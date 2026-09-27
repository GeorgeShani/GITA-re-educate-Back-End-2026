import { MigrationInterface, QueryRunner } from 'typeorm';

export class OutgoingWebhooks1790488051110 implements MigrationInterface {
  name = 'OutgoingWebhooks1790488051110';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "webhook_endpoint" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "companyId" uuid NOT NULL, "createdByUserId" uuid NOT NULL, "name" text NOT NULL, "url" text NOT NULL, "events" text array NOT NULL, "encryptedSecret" text NOT NULL, "secretIv" text NOT NULL, "secretTag" text NOT NULL, "active" boolean NOT NULL DEFAULT true, "consecutiveFailures" integer NOT NULL DEFAULT '0', "disabledAt" TIMESTAMP WITH TIME ZONE, "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_6c98112122b2b8a4f3984d2efa8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_webhook_endpoint_company_created" ON "webhook_endpoint"  ("companyId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "webhook_delivery" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "companyId" uuid NOT NULL, "endpointId" uuid NOT NULL, "eventId" uuid NOT NULL, "eventType" text NOT NULL, "envelope" jsonb NOT NULL, "status" text NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT '0', "responseStatus" integer, "lastError" text, "deliveredAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_b1ae290239a778f12399db91354" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_webhook_delivery_company_endpoint_created" ON "webhook_delivery"  ("companyId", "endpointId", "createdAt") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_webhook_delivery_endpoint_event" ON "webhook_delivery"  ("endpointId", "eventId") `,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."background_task_type" ADD VALUE 'deliver_webhook'`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_endpoint" ADD CONSTRAINT "FK_50de844557e8ae67fe8649f705f" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_endpoint" ADD CONSTRAINT "FK_5bb4a93b8c81627a7af573bd9a5" FOREIGN KEY ("createdByUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_delivery" ADD CONSTRAINT "FK_265483ffb3cb238f26b6f330b8a" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_delivery" ADD CONSTRAINT "FK_aa80c1d0b71d372bd9d844ada20" FOREIGN KEY ("endpointId") REFERENCES "webhook_endpoint"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook_delivery" DROP CONSTRAINT "FK_aa80c1d0b71d372bd9d844ada20"`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_delivery" DROP CONSTRAINT "FK_265483ffb3cb238f26b6f330b8a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_endpoint" DROP CONSTRAINT "FK_5bb4a93b8c81627a7af573bd9a5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_endpoint" DROP CONSTRAINT "FK_50de844557e8ae67fe8649f705f"`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."background_task_type_old" AS ENUM('send_email', 'build_data_quality_report', 'sync_stripe_seats', 'report_stripe_usage')`,
    );
    await queryRunner.query(
      `ALTER TABLE "background_task" ALTER COLUMN "type" TYPE "public"."background_task_type_old" USING "type"::"text"::"public"."background_task_type_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."background_task_type"`);
    await queryRunner.query(
      `ALTER TYPE "public"."background_task_type_old" RENAME TO "background_task_type"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."uq_webhook_delivery_endpoint_event"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_webhook_delivery_company_endpoint_created"`,
    );
    await queryRunner.query(`DROP TABLE "webhook_delivery"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_webhook_endpoint_company_created"`,
    );
    await queryRunner.query(`DROP TABLE "webhook_endpoint"`);
  }
}
