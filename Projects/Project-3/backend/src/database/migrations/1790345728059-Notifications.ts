import { MigrationInterface, QueryRunner } from "typeorm";

export class Notifications1790345728059 implements MigrationInterface {
    name = 'Notifications1790345728059'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "notification" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "companyId" uuid NOT NULL, "userId" uuid NOT NULL, "type" text NOT NULL, "payload" jsonb NOT NULL, "readAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_705b6c7cdf9b2c2ff7ac7872cb7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_notification_company_user_created" ON "notification"  ("companyId", "userId", "createdAt", "id") `);
        await queryRunner.query(`CREATE TABLE "quota_alert" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "companyId" uuid NOT NULL, "periodKey" text NOT NULL, "threshold" integer NOT NULL, CONSTRAINT "uq_quota_alert_company_period_threshold" UNIQUE ("companyId", "periodKey", "threshold"), CONSTRAINT "PK_4295598e1f0065adad3580142b6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "notification" ADD CONSTRAINT "FK_ec0adb47d5237aef2018e3a9745" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notification" ADD CONSTRAINT "FK_1ced25315eb974b73391fb1c81b" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "quota_alert" ADD CONSTRAINT "FK_0635348cc65146df414f2ddd489" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "quota_alert" DROP CONSTRAINT "FK_0635348cc65146df414f2ddd489"`);
        await queryRunner.query(`ALTER TABLE "notification" DROP CONSTRAINT "FK_1ced25315eb974b73391fb1c81b"`);
        await queryRunner.query(`ALTER TABLE "notification" DROP CONSTRAINT "FK_ec0adb47d5237aef2018e3a9745"`);
        await queryRunner.query(`DROP TABLE "quota_alert"`);
        await queryRunner.query(`DROP INDEX "public"."idx_notification_company_user_created"`);
        await queryRunner.query(`DROP TABLE "notification"`);
    }

}
