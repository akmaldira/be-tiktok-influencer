import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from "typeorm";
import TrackedEntity from "./tracked.entity";
import UserEntity from "./user.entity";

@Entity({ name: "tbl_video_analysis" })
export default class VideoAnalysisEntity extends TrackedEntity {
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

  @Column({ name: "old_data", type: "text", nullable: true })
  oldData: string | null;

  @ManyToOne(() => UserEntity, (user) => user.videoAnalyses, {
    nullable: false,
  })
  @JoinColumn({ name: "user_id" })
  user: Relation<UserEntity>;
}
