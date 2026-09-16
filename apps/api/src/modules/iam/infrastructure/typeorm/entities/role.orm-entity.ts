import {
  Check,
  Column,
  Entity,
  Index,
  PrimaryColumn,
} from "typeorm";

@Entity({ name: "roles" })
@Index("uq_roles_code_ci", { synchronize: false })
@Index("ix_roles_is_active", ["isActive"])
@Check("ck_roles_code_nonblank", "btrim(code) <> ''")
@Check("ck_roles_name_nonblank", "btrim(name) <> ''")
export class RoleOrmEntity {
  @PrimaryColumn({
    name: "id",
    type: "uuid",
    primaryKeyConstraintName: "pk_roles",
  })
  id!: string;

  @Column({ name: "code", type: "varchar", length: 80 })
  code!: string;

  @Column({ name: "name", type: "varchar", length: 120 })
  name!: string;

  @Column({ name: "description", type: "text", nullable: true })
  description!: string | null;

  @Column({ name: "is_system", type: "boolean", default: false })
  isSystem!: boolean;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({
    name: "created_at",
    type: "timestamptz",
    default: () => "now()",
  })
  createdAt!: Date;

  @Column({
    name: "updated_at",
    type: "timestamptz",
    default: () => "now()",
  })
  updatedAt!: Date;
}
