import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { PermissionOrmEntity } from "./permission.orm-entity";
import { RoleOrmEntity } from "./role.orm-entity";

@Entity({ name: "role_permissions" })
@Index("ix_role_permissions_permission_id", ["permissionId"])
export class RolePermissionOrmEntity {
  @PrimaryColumn({
    name: "role_id",
    type: "uuid",
    primaryKeyConstraintName: "pk_role_permissions",
  })
  roleId!: string;

  @PrimaryColumn({
    name: "permission_id",
    type: "uuid",
    primaryKeyConstraintName: "pk_role_permissions",
  })
  permissionId!: string;

  @Column({
    name: "granted_at",
    type: "timestamptz",
    default: () => "now()",
  })
  grantedAt!: Date;

  @ManyToOne(() => RoleOrmEntity, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "role_id",
    referencedColumnName: "id",
    foreignKeyConstraintName: "fk_role_permissions_role",
  })
  role!: RoleOrmEntity;

  @ManyToOne(() => PermissionOrmEntity, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({
    name: "permission_id",
    referencedColumnName: "id",
    foreignKeyConstraintName: "fk_role_permissions_permission",
  })
  permission!: PermissionOrmEntity;
}
