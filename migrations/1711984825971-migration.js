const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Migration1711984825971 {
    name = 'Migration1711984825971'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TYPE "public"."tbl_campaign_objective_enum" AS ENUM('SALES', 'ENGAGEMENT', 'AWARENESS', 'DOWNLOADER')`);
        await queryRunner.query(`CREATE TYPE "public"."tbl_campaign_timeline_enum" AS ENUM('ONE_WEEK', 'TWO_WEEKS', 'THREE_WEEKS', 'FOUR_WEEKS')`);
        await queryRunner.query(`CREATE TABLE "tbl_campaign" ("created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "country" character varying(255) NOT NULL, "industry" character varying(255), "category" character varying(255) NOT NULL, "objective" "public"."tbl_campaign_objective_enum" NOT NULL, "product" text NOT NULL, "target_audience" text NOT NULL, "timeline" "public"."tbl_campaign_timeline_enum" NOT NULL, "user_id" uuid, CONSTRAINT "PK_4644c63d5e51b45b5737c3202ec" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tbl_feed_back" ("created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "rating" integer NOT NULL, "message" character varying NOT NULL, "user_id" uuid, CONSTRAINT "REL_2689e26732a7b36a9de4b5a83e" UNIQUE ("user_id"), CONSTRAINT "PK_fb0a1ecfd57e0f8fc5fb55278a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "tbl_campaign" ADD CONSTRAINT "FK_8fa189460b4f35166d515426109" FOREIGN KEY ("user_id") REFERENCES "tbl_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tbl_feed_back" ADD CONSTRAINT "FK_2689e26732a7b36a9de4b5a83e3" FOREIGN KEY ("user_id") REFERENCES "tbl_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "tbl_feed_back" DROP CONSTRAINT "FK_2689e26732a7b36a9de4b5a83e3"`);
        await queryRunner.query(`ALTER TABLE "tbl_campaign" DROP CONSTRAINT "FK_8fa189460b4f35166d515426109"`);
        await queryRunner.query(`DROP TABLE "tbl_feed_back"`);
        await queryRunner.query(`DROP TABLE "tbl_campaign"`);
        await queryRunner.query(`DROP TYPE "public"."tbl_campaign_timeline_enum"`);
        await queryRunner.query(`DROP TYPE "public"."tbl_campaign_objective_enum"`);
    }
}
