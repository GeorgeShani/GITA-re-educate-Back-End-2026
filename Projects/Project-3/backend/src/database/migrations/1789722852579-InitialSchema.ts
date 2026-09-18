import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789722852579 implements MigrationInterface {
    name = 'InitialSchema1789722852579'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."company_industry" AS ENUM('finance', 'e-commerce', 'healthcare', 'education', 'logistics', 'manufacturing', 'media', 'real-estate', 'technology', 'other')`);
        await queryRunner.query(`CREATE TYPE "public"."company_status" AS ENUM('pending_activation', 'active', 'suspended')`);
        await queryRunner.query(`CREATE TABLE "company" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" text NOT NULL, "billingEmail" text NOT NULL, "country" text NOT NULL, "industry" "public"."company_industry" NOT NULL, "status" "public"."company_status" NOT NULL DEFAULT 'pending_activation', "activatedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_056f7854a7afdba7cbd6d45fc20" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8c4a310244a1d4ea866bf4734a" ON "company"  ("billingEmail") `);
        await queryRunner.query(`CREATE TYPE "public"."user_role" AS ENUM('admin', 'employee')`);
        await queryRunner.query(`CREATE TYPE "public"."user_status" AS ENUM('invited', 'active', 'disabled')`);
        await queryRunner.query(`CREATE TABLE "user" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "companyId" uuid NOT NULL, "email" text NOT NULL, "fullName" text NOT NULL, "role" "public"."user_role" NOT NULL, "status" "public"."user_status" NOT NULL DEFAULT 'invited', "activatedAt" TIMESTAMP WITH TIME ZONE, "disabledAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_591885ad24a975062b8ce3230bc" UNIQUE ("companyId", "email"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."auth_provider" AS ENUM('password', 'google')`);
        await queryRunner.query(`CREATE TABLE "auth_identity" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "provider" "public"."auth_provider" NOT NULL, "providerUserId" text NOT NULL, "email" text, "emailVerified" boolean NOT NULL DEFAULT false, "passwordHash" text, "lastUsedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_ccc04ef1590e0c6e0416895fa2c" UNIQUE ("provider", "providerUserId"), CONSTRAINT "PK_3eeca3f18e671626194e553eb89" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2325ca218e23aa2ef1acf60187" ON "auth_identity"  ("userId") `);
        await queryRunner.query(`CREATE TYPE "public"."auth_token_type" AS ENUM('activation', 'invite', 'password_reset')`);
        await queryRunner.query(`CREATE TABLE "auth_token" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "type" "public"."auth_token_type" NOT NULL, "tokenHash" text NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "consumedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_4572ff5d1264c4a523f01aa86a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5a326267f11b44c0d62526bc71" ON "auth_token"  ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7634f50cfa7ac8e4e4d5f31e35" ON "auth_token"  ("tokenHash") `);
        await queryRunner.query(`CREATE TABLE "refresh_token" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid NOT NULL, "tokenHash" text NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "revokedAt" TIMESTAMP WITH TIME ZONE, "replacedById" uuid, "userAgent" text, "ip" text, CONSTRAINT "PK_b575dd3c21fb0831013c909e7fe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8e913e288156c133999341156a" ON "refresh_token"  ("userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_204f27bcee2b705b8230beaf41" ON "refresh_token"  ("tokenHash") `);
        await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "FK_86586021a26d1180b0968f98502" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "auth_identity" ADD CONSTRAINT "FK_2325ca218e23aa2ef1acf60187e" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "auth_token" ADD CONSTRAINT "FK_5a326267f11b44c0d62526bc718" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "refresh_token" ADD CONSTRAINT "FK_8e913e288156c133999341156ad" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "refresh_token" DROP CONSTRAINT "FK_8e913e288156c133999341156ad"`);
        await queryRunner.query(`ALTER TABLE "auth_token" DROP CONSTRAINT "FK_5a326267f11b44c0d62526bc718"`);
        await queryRunner.query(`ALTER TABLE "auth_identity" DROP CONSTRAINT "FK_2325ca218e23aa2ef1acf60187e"`);
        await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "FK_86586021a26d1180b0968f98502"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_204f27bcee2b705b8230beaf41"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8e913e288156c133999341156a"`);
        await queryRunner.query(`DROP TABLE "refresh_token"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7634f50cfa7ac8e4e4d5f31e35"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5a326267f11b44c0d62526bc71"`);
        await queryRunner.query(`DROP TABLE "auth_token"`);
        await queryRunner.query(`DROP TYPE "public"."auth_token_type"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2325ca218e23aa2ef1acf60187"`);
        await queryRunner.query(`DROP TABLE "auth_identity"`);
        await queryRunner.query(`DROP TYPE "public"."auth_provider"`);
        await queryRunner.query(`DROP TABLE "user"`);
        await queryRunner.query(`DROP TYPE "public"."user_status"`);
        await queryRunner.query(`DROP TYPE "public"."user_role"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8c4a310244a1d4ea866bf4734a"`);
        await queryRunner.query(`DROP TABLE "company"`);
        await queryRunner.query(`DROP TYPE "public"."company_status"`);
        await queryRunner.query(`DROP TYPE "public"."company_industry"`);
    }

}
