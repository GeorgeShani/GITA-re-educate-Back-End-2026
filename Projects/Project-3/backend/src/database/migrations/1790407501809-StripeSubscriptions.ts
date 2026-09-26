import { MigrationInterface, QueryRunner } from "typeorm";

export class StripeSubscriptions1790407501809 implements MigrationInterface {
    name = 'StripeSubscriptions1790407501809'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "invoice" DROP CONSTRAINT "UQ_cb60ef5d52834ad9213fc64e84a"`);
        await queryRunner.query(`CREATE TYPE "public"."billing_account_status" AS ENUM('current', 'past_due', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "billing_account" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "companyId" uuid NOT NULL, "stripeCustomerId" text, "stripeSubscriptionId" text, "stripeSeatItemId" text, "status" "public"."billing_account_status" NOT NULL DEFAULT 'current', "graceEndsAt" TIMESTAMP WITH TIME ZONE, "pendingIntentId" uuid, "pendingCheckoutSessionId" text, "pendingPlan" "public"."subscription_plan", "pendingCreatedAt" TIMESTAMP WITH TIME ZONE, "seatRevision" integer NOT NULL DEFAULT '0', "version" integer NOT NULL, CONSTRAINT "REL_53a8164a8c76a51359ff5507dd" UNIQUE ("companyId"), CONSTRAINT "PK_42d2c4ab8974627eb4ef1da8fb6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a510ed93b9b5f88011295d4d7f" ON "billing_account"  ("stripeCustomerId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0c41eaefbe94ac7cb3134ecc3c" ON "billing_account"  ("stripeSubscriptionId") `);
        await queryRunner.query(`CREATE TYPE "public"."seat_sync_status" AS ENUM('pending', 'succeeded')`);
        await queryRunner.query(`CREATE TABLE "seat_sync" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "companyId" uuid NOT NULL, "sequence" integer NOT NULL, "activeEmployees" integer NOT NULL, "effectiveAt" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."seat_sync_status" NOT NULL DEFAULT 'pending', "deliveredAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_17777df566f650003c443e6d5ac" UNIQUE ("companyId", "sequence"), CONSTRAINT "PK_37d25825bf015e688332823154c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_seat_sync_company_status_sequence" ON "seat_sync"  ("companyId", "status", "sequence") `);
        await queryRunner.query(`CREATE TABLE "stripe_event" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "stripeEventId" text NOT NULL, "type" text NOT NULL, "stripeCreatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "livemode" boolean NOT NULL, "processedAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_7a91ab435defe9ce0ee6fb6f7f7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e346c225221ea580307a359231" ON "stripe_event"  ("stripeEventId") `);
        await queryRunner.query(`CREATE TYPE "public"."invoice_provider" AS ENUM('local', 'stripe')`);
        await queryRunner.query(`ALTER TABLE "invoice" ADD "provider" "public"."invoice_provider" NOT NULL DEFAULT 'local'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_invoice_local_period_unique" ON "invoice" ("companyId", "periodStart") WHERE "provider" = 'local'`);
        await queryRunner.query(`ALTER TABLE "invoice" ADD "stripeInvoiceId" text`);
        await queryRunner.query(`ALTER TABLE "invoice" ADD "stripeHostedInvoiceUrl" text`);
        await queryRunner.query(`ALTER TABLE "invoice" ADD "stripeInvoicePdfUrl" text`);
        await queryRunner.query(`ALTER TABLE "invoice" ADD "currency" text`);
        await queryRunner.query(`ALTER TABLE "invoice" ADD "paymentAttempts" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "invoice" ADD "lastPaymentAttemptAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "invoice" ADD "paidAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "usage_event" ADD "stripeReportedAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TYPE "public"."invoice_status" ADD VALUE 'draft'`);
        await queryRunner.query(`ALTER TYPE "public"."invoice_status" ADD VALUE 'open'`);
        await queryRunner.query(`ALTER TYPE "public"."invoice_status" ADD VALUE 'paid'`);
        await queryRunner.query(`ALTER TYPE "public"."invoice_status" ADD VALUE 'uncollectible'`);
        await queryRunner.query(`ALTER TYPE "public"."invoice_status" ADD VALUE 'void'`);
        await queryRunner.query(`ALTER TYPE "public"."background_task_type" ADD VALUE 'sync_stripe_seats'`);
        await queryRunner.query(`ALTER TYPE "public"."background_task_type" ADD VALUE 'report_stripe_usage'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ccdbbb78ab728aa8aa1ba207d2" ON "invoice"  ("stripeInvoiceId") `);
        await queryRunner.query(`ALTER TABLE "billing_account" ADD CONSTRAINT "FK_53a8164a8c76a51359ff5507ddd" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "seat_sync" ADD CONSTRAINT "FK_092a793858e64d9cb01f2e794c9" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "seat_sync" DROP CONSTRAINT "FK_092a793858e64d9cb01f2e794c9"`);
        await queryRunner.query(`ALTER TABLE "billing_account" DROP CONSTRAINT "FK_53a8164a8c76a51359ff5507ddd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ccdbbb78ab728aa8aa1ba207d2"`);
        await queryRunner.query(`DELETE FROM "background_task" WHERE "type" IN ('sync_stripe_seats', 'report_stripe_usage')`);
        await queryRunner.query(`CREATE TYPE "public"."background_task_type_old" AS ENUM('send_email', 'build_data_quality_report')`);
        await queryRunner.query(`ALTER TABLE "background_task" ALTER COLUMN "type" TYPE "public"."background_task_type_old" USING "type"::"text"::"public"."background_task_type_old"`);
        await queryRunner.query(`DROP TYPE "public"."background_task_type"`);
        await queryRunner.query(`ALTER TYPE "public"."background_task_type_old" RENAME TO "background_task_type"`);
        await queryRunner.query(`DELETE FROM "invoice" WHERE "provider" = 'stripe'`);
        await queryRunner.query(`CREATE TYPE "public"."invoice_status_old" AS ENUM('finalized')`);
        await queryRunner.query(`ALTER TABLE "invoice" ALTER COLUMN "status" TYPE "public"."invoice_status_old" USING "status"::"text"::"public"."invoice_status_old"`);
        await queryRunner.query(`DROP TYPE "public"."invoice_status"`);
        await queryRunner.query(`ALTER TYPE "public"."invoice_status_old" RENAME TO "invoice_status"`);
        await queryRunner.query(`ALTER TABLE "usage_event" DROP COLUMN "stripeReportedAt"`);
        await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "paidAt"`);
        await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "lastPaymentAttemptAt"`);
        await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "paymentAttempts"`);
        await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "currency"`);
        await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "stripeInvoicePdfUrl"`);
        await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "stripeHostedInvoiceUrl"`);
        await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "stripeInvoiceId"`);
        await queryRunner.query(`DROP INDEX "public"."idx_invoice_local_period_unique"`);
        await queryRunner.query(`ALTER TABLE "invoice" DROP COLUMN "provider"`);
        await queryRunner.query(`DROP TYPE "public"."invoice_provider"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e346c225221ea580307a359231"`);
        await queryRunner.query(`DROP TABLE "stripe_event"`);
        await queryRunner.query(`DROP INDEX "public"."idx_seat_sync_company_status_sequence"`);
        await queryRunner.query(`DROP TABLE "seat_sync"`);
        await queryRunner.query(`DROP TYPE "public"."seat_sync_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0c41eaefbe94ac7cb3134ecc3c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a510ed93b9b5f88011295d4d7f"`);
        await queryRunner.query(`DROP TABLE "billing_account"`);
        await queryRunner.query(`DROP TYPE "public"."billing_account_status"`);
        await queryRunner.query(`ALTER TABLE "invoice" ADD CONSTRAINT "UQ_cb60ef5d52834ad9213fc64e84a" UNIQUE ("companyId", "periodStart")`);
    }

}
