import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from "typeorm";
import CampaignAnalysisEntity from "./campaign-analysis.entity";
import TrackedEntity from "./tracked.entity";

@Entity({ name: "tbl_campaign_analysis_detail" })
export default class CampaignAnalysisDetailEntity extends TrackedEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255, name: "video_url" })
  videoUrl: string;

  @Column({ name: "like_count", type: "bigint" })
  likeCount: number;

  @Column({ name: "comment_count", type: "bigint" })
  commentCount: number;

  @Column({ name: "share_count", type: "bigint" })
  shareCount: number;

  @Column({ name: "view_count", type: "bigint" })
  viewCount: number;

  @Column({ name: "collect_count", type: "bigint" })
  collectCount: number;

  @Column({ name: "engagement_rate", type: "decimal" })
  engagementRate: number;

  @Column({ name: "cost", type: "bigint", nullable: true })
  cost: number | null;

  @Column({ name: "old_data", type: "text", nullable: true })
  oldData: string | null;

  @ManyToOne(
    () => CampaignAnalysisEntity,
    (campaignAnalysis) => campaignAnalysis.details,
  )
  @JoinColumn({ name: "campaign_analysis_id" })
  campaignAnalysis: Relation<CampaignAnalysisEntity>;
}
