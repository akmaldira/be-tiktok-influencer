import { BaseEntity, Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "tbl_tiktok_country" })
export default class TiktokCountryEntity extends BaseEntity {
  @PrimaryColumn({ type: "varchar", length: 10 })
  id: string;

  @Column({ type: "varchar", length: 255 })
  value: string;

  @Column({ type: "varchar", length: 255 })
  label: string;
}
