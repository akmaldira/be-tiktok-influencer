import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from "typeorm";
import { Objective, Timeline } from "./enum";
import TrackedEntity from "./tracked.entity";
import UserEntity from "./user.entity";

@Entity({ name: "tbl_campaign" })
export default class CampaignEntity extends TrackedEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 255, name: "country", nullable: true })
  country: string | null;

  @Column({ type: "varchar", length: 255, name: "industry", nullable: true })
  industry: string | null;

  @Column({ type: "varchar", length: 255, name: "category", nullable: true })
  category: string | null;

  @Column({ type: "enum", enum: Objective, name: "objective" })
  objective: Objective;

  @Column({ type: "text", name: "product" })
  product: string;

  @Column({ type: "text", name: "target_audience" })
  targetAudience: string;

  @Column({ type: "enum", enum: Timeline, name: "timeline" })
  timeline: Timeline;

  @Column({ type: "text", name: "result" })
  result: string;

  @ManyToOne(() => UserEntity, (user) => user.campaigns)
  @JoinColumn({ name: "user_id" })
  user: Relation<UserEntity>;
}
