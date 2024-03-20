import {
  BaseEntity,
  Column,
  Entity,
  ManyToMany,
  PrimaryColumn,
  Relation,
} from "typeorm";
import CreatorEntity from "./creator.entity";

@Entity({ name: "tbl_tiktok_industry" })
export default class TiktokIndustryEntity extends BaseEntity {
  @PrimaryColumn({ type: "varchar", length: 255 })
  id: string;

  @Column({ type: "varchar", length: 255 })
  value: string;

  @Column({ type: "varchar", length: 255 })
  label: string;

  @ManyToMany(() => CreatorEntity, (creator) => creator.industries)
  creators: Relation<CreatorEntity[]>;
}
