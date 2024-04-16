const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Migration1713106762880 {
    name = 'Migration1713106762880'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "tbl_video_analysis" ("created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id" uuid NOT NULL DEFAULT uuid_generate_v4(), "video_url" character varying(255) NOT NULL, "like_count" bigint NOT NULL, "comment_count" bigint NOT NULL, "share_count" bigint NOT NULL, "view_count" bigint NOT NULL, "collect_count" bigint NOT NULL, "old_data" text, "user_id" uuid NOT NULL, CONSTRAINT "PK_e6e26b69e0afc11c25250c5c3c9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "tbl_video_analysis" ADD CONSTRAINT "FK_9f6ab8f046ce2038fdb0f955bab" FOREIGN KEY ("user_id") REFERENCES "tbl_user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "tbl_video_analysis" DROP CONSTRAINT "FK_9f6ab8f046ce2038fdb0f955bab"`);
        await queryRunner.query(`DROP TABLE "tbl_video_analysis"`);
    }
}
