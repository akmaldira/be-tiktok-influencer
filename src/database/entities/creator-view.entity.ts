import {
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  ViewColumn,
  ViewEntity,
} from "typeorm";
import TiktokCountryEntity from "./tiktok-country.entity";
import TiktokIndustryEntity from "./tiktok-industry.entity";

@ViewEntity({
  name: "v_creator",
  expression: `WITH creator AS (
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
        CEIL(AVG(tcv.view_count)) as avg_view,
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
    c.avg_view,
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
    `,
})
export default class CreatorView {
  @ViewColumn({ name: "id" })
  @PrimaryColumn()
  id: string;

  @ViewColumn({ name: "avatar" })
  avatar: string | null;

  @Index("unique_id-idx", { unique: true })
  @ViewColumn({ name: "unique_id" })
  uniqueId: string;

  @ViewColumn({ name: "email" })
  email: string | null;

  @ViewColumn({ name: "nick_name" })
  nickName: string | null;

  @ManyToOne(() => TiktokCountryEntity, (country) => country.id)
  @JoinColumn({
    name: "country_id",
  })
  country: TiktokCountryEntity | null;

  @ViewColumn({
    name: "industries",
    // transformer: {
    //   from: (values: TiktokIndustryEntity[]) => {
    //     const uniqueIndustries = new Map();
    //     values.forEach((value) => {
    //       uniqueIndustries.set(value.id, value);
    //     });
    //     return Array.from(uniqueIndustries.values());
    //   },
    //   to: (value: any) => value,
    // },
  })
  industries: TiktokIndustryEntity[];

  @ViewColumn({ name: "language" })
  language: string | null;

  @ViewColumn({ name: "bio_link" })
  bioLink: string | null;

  @ViewColumn({ name: "verified" })
  verified: boolean | null;

  @ViewColumn({ name: "follower_count" })
  followerCount: number | null;

  @ViewColumn({ name: "video_count" })
  videoCount: number | null;

  @ViewColumn({ name: "like_count" })
  likeCount: number | null;

  @ViewColumn({ name: "comment_count" })
  commentCount: number | null;

  @ViewColumn({ name: "share_count" })
  shareCount: number | null;

  @ViewColumn({ name: "view_count" })
  viewCount: number | null;

  @ViewColumn({ name: "avg_view" })
  avgView: number | null;

  @ViewColumn({
    name: "suggested_words",
    // transformer: {
    //   from: (values: string[][]) => {
    //     if (!values) return null;
    //     const joinValues = values.flat(1);
    //     const uniqueCategories = new Map();
    //     joinValues.forEach((value) => {
    //       uniqueCategories.set(value, value);
    //     });
    //     return Array.from(uniqueCategories.values());
    //   },
    //   to: (value: any) => value,
    // },
  })
  suggestedWords: string[][] | null;

  @ViewColumn({
    name: "potential_categories",
    // transformer: {
    //   from: (values: string[][]) => {
    //     if (!values) return null;
    //     const joinValues = values.flat(1);
    //     const uniqueCategories = new Map();
    //     joinValues.forEach((value) => {
    //       uniqueCategories.set(value, value);
    //     });
    //     return Array.from(uniqueCategories.values());
    //   },
    //   to: (value: any) => value,
    // },
  })
  potentialCategories: string[][] | null;

  @ViewColumn({
    name: "address",
    // transformer: {
    //   from: (values: string[]) => {
    //     if (!values) return null;
    //     const uniqueCategories = new Map();
    //     values.forEach((value) => {
    //       uniqueCategories.set(value, value);
    //     });
    //     return Array.from(uniqueCategories.values());
    //   },
    //   to: (value: any) => value,
    // },
  })
  address: string[] | null;

  @ViewColumn({
    name: "text_extras",
    // transformer: {
    //   from: (values: { hashtagName: string }[][]) => {
    //     if (!values) return null;
    //     const joinValues = values.flat(1);
    //     const uniqueCategories = new Map();
    //     joinValues.forEach((value) => {
    //       if (value.hashtagName)
    //         uniqueCategories.set(value.hashtagName, value.hashtagName);
    //     });
    //     return Array.from(uniqueCategories.values());
    //   },
    //   to: (value: any) => value,
    // },
  })
  textExtras:
    | {
        hashtagName: string;
      }[][]
    | null;

  @ViewColumn({ name: "engagement_rate" })
  engagementRate: number;
}
