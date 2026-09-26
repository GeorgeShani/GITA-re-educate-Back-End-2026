import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommentsPresence1790450821659 implements MigrationInterface {
  name = 'CommentsPresence1790450821659';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "file_comment" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "companyId" uuid NOT NULL, "fileId" uuid NOT NULL, "authorId" uuid NOT NULL, "parentId" uuid, "body" text, "editedAt" TIMESTAMP WITH TIME ZONE, "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_aba3bcb764611e983e2b3b70c15" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_eaa53aff7806372c34899a6b9e" ON "file_comment"  ("parentId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_file_comment_company_file_created" ON "file_comment"  ("companyId", "fileId", "createdAt", "id") `,
    );
    await queryRunner.query(
      `CREATE TABLE "file_comment_mention" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "createdAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP(3) WITH TIME ZONE NOT NULL DEFAULT now(), "companyId" uuid NOT NULL, "commentId" uuid NOT NULL, "userId" uuid NOT NULL, CONSTRAINT "uq_file_comment_mention_comment_user" UNIQUE ("commentId", "userId"), CONSTRAINT "PK_adb1e8070c2bfa9e93f1dcc7df7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_file_comment_mention_company_user" ON "file_comment_mention"  ("companyId", "userId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "file_comment" ADD CONSTRAINT "FK_67e1b36516e70f6fb5f47f45c89" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "file_comment" ADD CONSTRAINT "FK_27e375c2454ec47cd843f4bed53" FOREIGN KEY ("fileId") REFERENCES "file_asset"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "file_comment" ADD CONSTRAINT "FK_41c538bd2395eae0c62a4309ece" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "file_comment" ADD CONSTRAINT "FK_eaa53aff7806372c34899a6b9e4" FOREIGN KEY ("parentId") REFERENCES "file_comment"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "file_comment_mention" ADD CONSTRAINT "FK_998d5f01aef095da9c184432951" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "file_comment_mention" ADD CONSTRAINT "FK_c6fed6752e4f1f035ca1c1ecf59" FOREIGN KEY ("commentId") REFERENCES "file_comment"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "file_comment_mention" ADD CONSTRAINT "FK_0ec77efe77df05109850b75ac9f" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "file_comment_mention" DROP CONSTRAINT "FK_0ec77efe77df05109850b75ac9f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "file_comment_mention" DROP CONSTRAINT "FK_c6fed6752e4f1f035ca1c1ecf59"`,
    );
    await queryRunner.query(
      `ALTER TABLE "file_comment_mention" DROP CONSTRAINT "FK_998d5f01aef095da9c184432951"`,
    );
    await queryRunner.query(
      `ALTER TABLE "file_comment" DROP CONSTRAINT "FK_eaa53aff7806372c34899a6b9e4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "file_comment" DROP CONSTRAINT "FK_41c538bd2395eae0c62a4309ece"`,
    );
    await queryRunner.query(
      `ALTER TABLE "file_comment" DROP CONSTRAINT "FK_27e375c2454ec47cd843f4bed53"`,
    );
    await queryRunner.query(
      `ALTER TABLE "file_comment" DROP CONSTRAINT "FK_67e1b36516e70f6fb5f47f45c89"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."idx_file_comment_mention_company_user"`,
    );
    await queryRunner.query(`DROP TABLE "file_comment_mention"`);
    await queryRunner.query(
      `DROP INDEX "public"."idx_file_comment_company_file_created"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_eaa53aff7806372c34899a6b9e"`,
    );
    await queryRunner.query(`DROP TABLE "file_comment"`);
  }
}
