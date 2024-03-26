const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class Migration1711494089327 {
    name = 'Migration1711494089327'

    async up(queryRunner) {
        await queryRunner.query(`CREATE VIEW "v_creator" AS WITH creator AS (
    SELECT
    	tc.id,
        tc.avatar,
        tc.unique_id,
        tc.nick_name,
        tc.bio_link,
        tc.follower_count,
        tc.video_count,
        tc."language",
        tc.visibility,
        tc.verified,
        tc.private,
        tc.email,
        tc.country_code as country_id,
        SUM(tcv.view_count) AS view_count,
        SUM(tcv.like_count) AS like_count,
        SUM(tcv.comment_count) AS comment_count,
        SUM(tcv.share_count) AS share_count,
        jsonb_agg(tcv.suggested_words ORDER BY tcv.suggested_words DESC) FILTER (WHERE tcv.suggested_words <> '[]') AS suggested_words,
        jsonb_agg(tcv.potential_categories ORDER BY tcv.potential_categories ASC) FILTER (WHERE tcv.potential_categories IS NOT NULL) AS potential_categories,
        jsonb_agg(tcv.text_extra ORDER BY tcv.text_extra ASC) FILTER (WHERE tcv.text_extra <> '[]') AS text_extras,
        jsonb_agg(tcv.address ORDER BY tcv.address ASC) FILTER (WHERE tcv.address IS NOT NULL) AS address,
        jsonb_agg(tti) as industries
    FROM
        tbl_creator tc 
    LEFT JOIN
        tbl_creator_video tcv ON tcv.creator_id = tc.id
    LEFT JOIN 
    	tbl_creators_industries tci on tci.creator_id = tc.id
   	LEFT JOIN
   		tbl_tiktok_industry tti on tti.id = tci.industry_id 
    WHERE
        tcv.view_count > 0
    GROUP by
    	tc.id,
        tc.avatar,
        tc.unique_id,
        tc.nick_name,
        tc.bio_link,
        tc."language",
        tc.follower_count,
        tc.video_count,
        tc.visibility,
        tc.verified,
        tc.private,
        tc.email
)
SELECT
	c.id,
    c.avatar,
    c.unique_id,
    c.nick_name,
    c.country_id,
    c."language",
    c.bio_link,
    c.follower_count,
    c.video_count,
    c.like_count,
    c.comment_count,
    c.share_count,
    c.view_count,
    c.suggested_words,
    c.potential_categories,
    c.address,
    c.text_extras,
    c.visibility,
    c.verified,
    c.private,
    c.email,
    c.industries,
    CASE
        WHEN c.like_count IS NULL OR c.comment_count IS NULL OR c.share_count IS NULL OR c.view_count IS NULL THEN 0
        WHEN c.like_count + c.comment_count + c.share_count = 0 THEN 0
        WHEN c.view_count = 0 THEN 0
        ELSE CAST(CAST(c.like_count + c.comment_count + c.share_count AS FLOAT) / CAST(c.view_count AS FLOAT) * 100 AS DECIMAL(10, 2))
    END AS engagement_rate
FROM
    creator c
    LEFT JOIN tbl_tiktok_country country on country.id = c.country_id
    `);
        await queryRunner.query(`INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value") VALUES (DEFAULT, $1, DEFAULT, $2, $3, $4)`, ["public","VIEW","v_creator","WITH creator AS (\n    SELECT\n    \ttc.id,\n        tc.avatar,\n        tc.unique_id,\n        tc.nick_name,\n        tc.bio_link,\n        tc.follower_count,\n        tc.video_count,\n        tc.\"language\",\n        tc.visibility,\n        tc.verified,\n        tc.private,\n        tc.email,\n        tc.country_code as country_id,\n        SUM(tcv.view_count) AS view_count,\n        SUM(tcv.like_count) AS like_count,\n        SUM(tcv.comment_count) AS comment_count,\n        SUM(tcv.share_count) AS share_count,\n        jsonb_agg(tcv.suggested_words ORDER BY tcv.suggested_words DESC) FILTER (WHERE tcv.suggested_words <> '[]') AS suggested_words,\n        jsonb_agg(tcv.potential_categories ORDER BY tcv.potential_categories ASC) FILTER (WHERE tcv.potential_categories IS NOT NULL) AS potential_categories,\n        jsonb_agg(tcv.text_extra ORDER BY tcv.text_extra ASC) FILTER (WHERE tcv.text_extra <> '[]') AS text_extras,\n        jsonb_agg(tcv.address ORDER BY tcv.address ASC) FILTER (WHERE tcv.address IS NOT NULL) AS address,\n        jsonb_agg(tti) as industries\n    FROM\n        tbl_creator tc \n    LEFT JOIN\n        tbl_creator_video tcv ON tcv.creator_id = tc.id\n    LEFT JOIN \n    \ttbl_creators_industries tci on tci.creator_id = tc.id\n   \tLEFT JOIN\n   \t\ttbl_tiktok_industry tti on tti.id = tci.industry_id \n    WHERE\n        tcv.view_count > 0\n    GROUP by\n    \ttc.id,\n        tc.avatar,\n        tc.unique_id,\n        tc.nick_name,\n        tc.bio_link,\n        tc.\"language\",\n        tc.follower_count,\n        tc.video_count,\n        tc.visibility,\n        tc.verified,\n        tc.private,\n        tc.email\n)\nSELECT\n\tc.id,\n    c.avatar,\n    c.unique_id,\n    c.nick_name,\n    c.country_id,\n    c.\"language\",\n    c.bio_link,\n    c.follower_count,\n    c.video_count,\n    c.like_count,\n    c.comment_count,\n    c.share_count,\n    c.view_count,\n    c.suggested_words,\n    c.potential_categories,\n    c.address,\n    c.text_extras,\n    c.visibility,\n    c.verified,\n    c.private,\n    c.email,\n    c.industries,\n    CASE\n        WHEN c.like_count IS NULL OR c.comment_count IS NULL OR c.share_count IS NULL OR c.view_count IS NULL THEN 0\n        WHEN c.like_count + c.comment_count + c.share_count = 0 THEN 0\n        WHEN c.view_count = 0 THEN 0\n        ELSE CAST(CAST(c.like_count + c.comment_count + c.share_count AS FLOAT) / CAST(c.view_count AS FLOAT) * 100 AS DECIMAL(10, 2))\n    END AS engagement_rate\nFROM\n    creator c\n    LEFT JOIN tbl_tiktok_country country on country.id = c.country_id"]);
    }

    async down(queryRunner) {
        await queryRunner.query(`DELETE FROM "typeorm_metadata" WHERE "type" = $1 AND "name" = $2 AND "schema" = $3`, ["VIEW","v_creator","public"]);
        await queryRunner.query(`DROP VIEW "v_creator"`);
    }
}
