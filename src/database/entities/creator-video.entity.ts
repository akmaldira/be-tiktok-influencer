import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Relation,
} from "typeorm";
import CreatorEntity from "./creator.entity";
import TrackedEntity from "./tracked.entity";

@Entity({ name: "tbl_creator_video" })
export default class CreatorVideoEntity extends TrackedEntity {
  @PrimaryColumn({ type: "varchar", length: 100 })
  id: string;

  @Column({ type: "text", nullable: true })
  desc: string | null;

  @Column({ name: "create_time", type: "int", nullable: true })
  createTime: number | null;

  @Column({ name: "text_extra", type: "jsonb", nullable: true })
  textExtra:
    | {
        awemeId: string | null;
        hashtagId: string | null;
        hashtagName: string | null;
      }[]
    | null;

  @Column({ name: "suggested_words", type: "jsonb", nullable: true })
  suggestedWords: string[] | null;

  @Column({ name: "potential_categories", type: "jsonb", nullable: true })
  potentialCategories: string[] | null;

  @Column({ name: "address", type: "varchar", length: 255, nullable: true })
  address: string | null;

  @Column({ name: "like_count", type: "bigint", nullable: true })
  likeCount: number | null;

  @Column({ name: "comment_count", type: "bigint", nullable: true })
  commentCount: number | null;

  @Column({ name: "share_count", type: "bigint", nullable: true })
  shareCount: number | null;

  @Column({ name: "view_count", type: "bigint", nullable: true })
  viewCount: number | null;

  @Column({ name: "collect_count", type: "bigint", nullable: true })
  collectCount: number | null;

  @ManyToOne(() => CreatorEntity, { nullable: false })
  @JoinColumn({ name: "creator_id" })
  creator: Relation<CreatorEntity>;
}
