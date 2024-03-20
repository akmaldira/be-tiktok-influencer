import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import TiktokCountryEntity from "./tiktok-country.entity";
import TiktokIndustryEntity from "./tiktok-industry.entity";
import TrackedEntity from "./tracked.entity";

@Entity({ name: "tbl_tiktok_hashtag" })
export default class TiktokHashtagEntity extends TrackedEntity {
  @PrimaryColumn()
  id: string;

  @Column({ type: "varchar", length: 255, unique: true })
  name: string;

  @Column({ name: "is_promoted", type: "boolean", nullable: true })
  isPromoted: boolean | null;

  @Column({ name: "publish_count", type: "bigint", nullable: true })
  publishCount: number | null;

  @Column({ name: "video_views", type: "bigint", nullable: true })
  videoViews: number | null;

  @Column({ type: "jsonb", nullable: true })
  trend: { time: number; value: number }[] | null;

  @ManyToOne(() => TiktokCountryEntity)
  @JoinColumn({ name: "country_code" })
  country: TiktokCountryEntity;

  @ManyToOne(() => TiktokIndustryEntity)
  @JoinColumn({ name: "industry_id" })
  industry: TiktokIndustryEntity;
}
