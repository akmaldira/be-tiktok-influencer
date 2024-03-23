import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  Relation,
} from "typeorm";
import CreatorVideoEntity from "./creator-video.entity";
import TiktokCountryEntity from "./tiktok-country.entity";
import TiktokIndustryEntity from "./tiktok-industry.entity";
import TrackedEntity from "./tracked.entity";

@Entity({ name: "tbl_creator" })
export default class CreatorEntity extends TrackedEntity {
  @PrimaryColumn({ name: "id", type: "varchar", length: 100 })
  id: string;

  @Column({ name: "unique_id", type: "varchar", length: 100, unique: true })
  uniqueId: string;

  @Column({ name: "nick_name", type: "varchar", length: 100, nullable: true })
  nickName: string | null;

  @Column({ name: "tt_seller", type: "boolean", nullable: true })
  ttSeller: boolean | null;

  @Column({ type: "varchar", length: 100, nullable: true })
  language: string | null;

  @Column({ type: "varchar", nullable: true })
  avatar: string | null;

  @Column({ type: "boolean", nullable: true })
  private: boolean | null;

  @Column({ type: "boolean", nullable: true })
  verified: boolean | null;

  @Column({ default: false })
  visibility: boolean;

  @Column({ type: "varchar", nullable: true })
  description: string | null;

  @Column({ name: "bio_link", type: "varchar", length: 255, nullable: true })
  bioLink: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  email: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  phone: string | null;

  @Column({ type: "varchar", length: 255, nullable: true })
  instagram: string | null;

  @Column({
    name: "follower_count",
    type: "bigint",
    nullable: true,
  })
  followerCount: number | null;

  @Column({
    name: "like_count",
    type: "bigint",
    nullable: true,
  })
  likeCount: number | null;

  @Column({
    name: "video_count",
    type: "bigint",
    nullable: true,
  })
  videoCount: number | null;

  @Column({
    name: "view_count",
    type: "bigint",
    nullable: true,
  })
  viewCount: number | null;

  @Column({
    name: "comment_count",
    type: "bigint",
    nullable: true,
  })
  commentCount: number | null;

  @Column({
    name: "share_count",
    type: "bigint",
    nullable: true,
  })
  shareCount: number | null;

  @Column({
    name: "collect_count",
    type: "bigint",
    nullable: true,
  })
  collectCount: number | null;

  @Column({ name: "update_count", type: "int", default: 0 })
  updateCount: number;

  @ManyToOne(() => TiktokCountryEntity, {
    onUpdate: "CASCADE",
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "country_code" })
  country: Relation<TiktokCountryEntity>;

  @ManyToMany(() => TiktokIndustryEntity, (industry) => industry.creators)
  @JoinTable({
    name: "tbl_creators_industries",
    joinColumn: {
      name: "creator_id",
      referencedColumnName: "id",
    },
    inverseJoinColumn: {
      name: "industry_id",
      referencedColumnName: "id",
    },
  })
  industries: Relation<TiktokIndustryEntity[]>;

  @OneToMany(() => CreatorVideoEntity, (video) => video.creator)
  videos: CreatorVideoEntity[];
}
