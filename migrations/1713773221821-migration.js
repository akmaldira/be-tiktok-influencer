const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Migration1713773221821 {
    name = 'Migration1713773221821'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "tbl_campaign_analysis_detail" ("created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "video_url" character varying(255) NOT NULL, "like_count" bigint NOT NULL, "comment_count" bigint NOT NULL, "share_count" bigint NOT NULL, "view_count" bigint NOT NULL, "collect_count" bigint NOT NULL, "engagement_rate" numeric NOT NULL, "cost" bigint, "old_data" text, "campaign_analysis_id" uuid, CONSTRAINT "PK_46657dbe639609fb1facc3805cf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tbl_campaign_analysis" ("created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "campaign_name" character varying(255) NOT NULL, "user_id" uuid, CONSTRAINT "PK_cfb6589e3b20cd66a52c213e9bf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "tbl_campaign_analysis_detail" ADD CONSTRAINT "FK_c7f13141af8b61ad012683b4b98" FOREIGN KEY ("campaign_analysis_id") REFERENCES "tbl_campaign_analysis"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tbl_campaign_analysis" ADD CONSTRAINT "FK_868a2aa7bc0c472f5992d83fe88" FOREIGN KEY ("user_id") REFERENCES "tbl_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "tbl_campaign_analysis" DROP CONSTRAINT "FK_868a2aa7bc0c472f5992d83fe88"`);
        await queryRunner.query(`ALTER TABLE "tbl_campaign_analysis_detail" DROP CONSTRAINT "FK_c7f13141af8b61ad012683b4b98"`);
        await queryRunner.query(`DROP TABLE "tbl_campaign_analysis"`);
        await queryRunner.query(`DROP TABLE "tbl_campaign_analysis_detail"`);
    }
}
