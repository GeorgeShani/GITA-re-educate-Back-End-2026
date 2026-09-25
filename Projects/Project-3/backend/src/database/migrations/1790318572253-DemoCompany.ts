import { MigrationInterface, QueryRunner } from "typeorm";

export class DemoCompany1790318572253 implements MigrationInterface {
    name = 'DemoCompany1790318572253'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "company" ADD "isDemo" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "company" DROP COLUMN "isDemo"`);
    }

}
