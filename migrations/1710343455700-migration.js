const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Migration1710343455700 {
    name = 'Migration1710343455700'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."tbl_user_provider_enum" AS ENUM('credential', 'google')`);
        await queryRunner.query(`CREATE TYPE "public"."tbl_user_role_enum" AS ENUM('admin', 'user')`);
        await queryRunner.query(`CREATE TABLE "tbl_user" ("created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "provider" "public"."tbl_user_provider_enum" NOT NULL DEFAULT 'credential', "name" character varying(255) NOT NULL, "email" character varying(255) NOT NULL, "avatar" character varying(255), "password" character varying(255), "role" "public"."tbl_user_role_enum" NOT NULL DEFAULT 'user', CONSTRAINT "PK_1262f713cac678ecfe15460073b" PRIMARY KEY ("id"))`);
    }

    async down(queryRunner) {
        await queryRunner.query(`DROP TABLE "tbl_user"`);
        await queryRunner.query(`DROP TYPE "public"."tbl_user_role_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tbl_user_provider_enum"`);
    }
}
