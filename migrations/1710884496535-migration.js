const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Migration1710884496535 {
    name = 'Migration1710884496535'

    async up(queryRunner) {
        await queryRunner.query(`CREATE TABLE "tbl_tiktok_country" ("id" character varying(10) NOT NULL, "value" character varying(255) NOT NULL, "label" character varying(255) NOT NULL, CONSTRAINT "PK_625ec311f665fa08bee1411c9ef" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tbl_creator" ("created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id" character varying(100) NOT NULL, "unique_id" character varying(100) NOT NULL, "nick_name" character varying(100), "language" character varying(100), "avatar" character varying, "private" boolean, "verified" boolean, "visibility" boolean NOT NULL DEFAULT false, "description" character varying, "bio_link" character varying(255), "email" character varying(255), "phone" character varying(255), "instagram" character varying(255), "follower_count" bigint, "like_count" bigint, "video_count" bigint, "view_count" bigint, "country_code" character varying(10), CONSTRAINT "UQ_459d36f306d2f3026dd36b856f4" UNIQUE ("unique_id"), CONSTRAINT "PK_72efe8eecd96cad56db1ac4c7bf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tbl_tiktok_industry" ("id" character varying(255) NOT NULL, "value" character varying(255) NOT NULL, "label" character varying(255) NOT NULL, CONSTRAINT "PK_a4868f5f13b70e64560f4de251d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tbl_tiktok_hashtag" ("created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id" character varying NOT NULL, "name" character varying(255) NOT NULL, "is_promoted" boolean, "publish_count" bigint, "video_views" bigint, "trend" jsonb, "country_code" character varying(10), "industry_id" character varying(255), CONSTRAINT "UQ_afe39941628e99f323b358673a4" UNIQUE ("name"), CONSTRAINT "PK_6edc3649f73942a4261b2b2587d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "tbl_creators_industries" ("creator_id" character varying(100) NOT NULL, "industry_id" character varying(255) NOT NULL, CONSTRAINT "PK_17f500f336ca343a4b2e0cb9ebe" PRIMARY KEY ("creator_id", "industry_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ce6897ad2af44210730b5f5a34" ON "tbl_creators_industries" ("creator_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_cf37719728d2319a36e7f30377" ON "tbl_creators_industries" ("industry_id") `);
        await queryRunner.query(`ALTER TABLE "tbl_creator" ADD CONSTRAINT "FK_65b9c6000bf6da93df29ce819b3" FOREIGN KEY ("country_code") REFERENCES "tbl_tiktok_country"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "tbl_tiktok_hashtag" ADD CONSTRAINT "FK_78de5004185ca6e554a5e9eeb34" FOREIGN KEY ("country_code") REFERENCES "tbl_tiktok_country"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tbl_tiktok_hashtag" ADD CONSTRAINT "FK_dc62702006b6aafa14966aec130" FOREIGN KEY ("industry_id") REFERENCES "tbl_tiktok_industry"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tbl_creators_industries" ADD CONSTRAINT "FK_ce6897ad2af44210730b5f5a34c" FOREIGN KEY ("creator_id") REFERENCES "tbl_creator"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "tbl_creators_industries" ADD CONSTRAINT "FK_cf37719728d2319a36e7f303778" FOREIGN KEY ("industry_id") REFERENCES "tbl_tiktok_industry"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "tbl_creators_industries" DROP CONSTRAINT "FK_cf37719728d2319a36e7f303778"`);
        await queryRunner.query(`ALTER TABLE "tbl_creators_industries" DROP CONSTRAINT "FK_ce6897ad2af44210730b5f5a34c"`);
        await queryRunner.query(`ALTER TABLE "tbl_tiktok_hashtag" DROP CONSTRAINT "FK_dc62702006b6aafa14966aec130"`);
        await queryRunner.query(`ALTER TABLE "tbl_tiktok_hashtag" DROP CONSTRAINT "FK_78de5004185ca6e554a5e9eeb34"`);
        await queryRunner.query(`ALTER TABLE "tbl_creator" DROP CONSTRAINT "FK_65b9c6000bf6da93df29ce819b3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cf37719728d2319a36e7f30377"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ce6897ad2af44210730b5f5a34"`);
        await queryRunner.query(`DROP TABLE "tbl_creators_industries"`);
        await queryRunner.query(`DROP TABLE "tbl_tiktok_hashtag"`);
        await queryRunner.query(`DROP TABLE "tbl_tiktok_industry"`);
        await queryRunner.query(`DROP TABLE "tbl_creator"`);
        await queryRunner.query(`DROP TABLE "tbl_tiktok_country"`);
    }
}
