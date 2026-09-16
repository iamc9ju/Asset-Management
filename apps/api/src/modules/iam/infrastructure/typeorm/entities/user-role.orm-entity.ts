import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { RoleOrmEntity } from "./role.orm-entity";
import { UserOrmEntity } from "./user.orm-entity";

@Entity({ name: "user_roles" })
@Index("ix_user_roles_role_id", ["roleId"])
export class UserRoleOrmEntity {
  @PrimaryColumn({
    name: "user_id",
    type: "uuid",
    primaryKeyConstraintName: "pk_user_roles",
  })
  userId!: string;

  @PrimaryColumn({
    name: "role_id",
    type: "uuid",
    primaryKeyConstraintName: "pk_user_roles",
  })
  roleId!: string;

  @Column({ name: "granted_by", type: "uuid", nullable: true })
  grantedBy!: string | null;

  @Column({
    name: "granted_at",
    type: "timestamptz",
    default: () => "now()",
  })
  grantedAt!: Date;

  @ManyToOne(() => UserOrmEntity, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({
    name: "user_id",
    referencedColumnName: "id",
    foreignKeyConstraintName: "fk_user_roles_user",
  })
  user!: UserOrmEntity;

  @ManyToOne(() => RoleOrmEntity, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({
    name: "role_id",
    referencedColumnName: "id",
    foreignKeyConstraintName: "fk_user_roles_role",
  })
  role!: RoleOrmEntity;

  @ManyToOne(() => UserOrmEntity, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({
    name: "granted_by",
    referencedColumnName: "id",
    foreignKeyConstraintName: "fk_user_roles_granted_by",
  })
  grantedByUser!: UserOrmEntity | null;
}
