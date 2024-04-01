import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  Relation,
} from "typeorm";
import TrackedEntity from "./tracked.entity";
import UserEntity from "./user.entity";

@Entity({ name: "tbl_feed_back" })
export default class FeedBackEntity extends TrackedEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "int", name: "rating" })
  rating: number;

  @Column({ type: "varchar", name: "message" })
  message: string;

  @OneToOne(() => UserEntity)
  @JoinColumn({ name: "user_id" })
  user: Relation<UserEntity>;
}
