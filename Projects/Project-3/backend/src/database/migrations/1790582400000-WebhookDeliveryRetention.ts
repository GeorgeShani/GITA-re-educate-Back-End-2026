import { MigrationInterface, QueryRunner } from 'typeorm';

export class WebhookDeliveryRetention1790582400000
  implements MigrationInterface
{
  name = 'WebhookDeliveryRetention1790582400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "idx_webhook_delivery_created_at" ON "webhook_delivery" ("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_webhook_delivery_created_at"`,
    );
  }
}
