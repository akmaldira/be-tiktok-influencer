import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
} from "typeorm";
import CampaignAnalysis from "./campaign-analysis.entity";
import CampaignEntity from "./campaign.entity";
import { Provider, UserRole } from "./enum";
import TrackedEntity from "./tracked.entity";

@Entity({ name: "tbl_user" })
export default class UserEntity extends TrackedEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "enum", enum: Provider, default: Provider.CREDENTIAL })
  provider: Provider;

  @Column({ type: "varchar", length: 255 })
  name: string;

  @Column({ type: "varchar", length: 255 })
  email: string;

  @Column({ type: "varchar", length: 255, nullable: true })
  avatar: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  password: string | null;

  @Column({ type: "enum", enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @OneToMany(() => CampaignEntity, (campaign) => campaign.user)
  campaigns: Relation<CampaignEntity[]>;

  @OneToMany(() => CampaignAnalysis, (videoAnalysis) => videoAnalysis.user)
  campaignAnalyses: Relation<CampaignAnalysis[]>;
}
