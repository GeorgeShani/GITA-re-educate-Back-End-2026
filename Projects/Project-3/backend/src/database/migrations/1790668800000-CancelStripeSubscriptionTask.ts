import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A second Stripe subscription that must not exist is now cancelled by a queued task, in the same transaction as the
 * webhook event that found it, instead of by a call made after that transaction (which a Stripe outage lost for good).
 */
export class CancelStripeSubscriptionTask1790668800000
  implements MigrationInterface
{
  name = 'CancelStripeSubscriptionTask1790668800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."background_task_type" ADD VALUE 'cancel_stripe_subscription'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "background_task" WHERE "type" = 'cancel_stripe_subscription'`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."background_task_type_old" AS ENUM('send_email', 'build_data_quality_report', 'sync_stripe_seats', 'report_stripe_usage', 'deliver_webhook')`,
    );
    await queryRunner.query(
      `ALTER TABLE "background_task" ALTER COLUMN "type" TYPE "public"."background_task_type_old" USING "type"::"text"::"public"."background_task_type_old"`,
    );
    await queryRunner.query(`DROP TYPE "public"."background_task_type"`);
    await queryRunner.query(
      `ALTER TYPE "public"."background_task_type_old" RENAME TO "background_task_type"`,
    );
  }
}
