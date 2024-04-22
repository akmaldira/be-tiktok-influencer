import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
} from "typeorm";
import CampaignAnalysisDetailEntity from "./campaign-analysis-detail.entity";
import TrackedEntity from "./tracked.entity";
import UserEntity from "./user.entity";

@Entity({ name: "tbl_campaign_analysis" })
export default class CampaignAnalysisEntity extends TrackedEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255, name: "campaign_name" })
  campaignName: string;

  @OneToMany(
    () => CampaignAnalysisDetailEntity,
    (detail) => detail.campaignAnalysis,
  )
  details: Relation<CampaignAnalysisDetailEntity[]>;

  @ManyToOne(() => UserEntity, (user) => user.campaignAnalyses)
  @JoinColumn({ name: "user_id" })
  user: Relation<UserEntity>;
}
