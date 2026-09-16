import {
  Check,
  Column,
  Entity,
  Index,
  PrimaryColumn,
} from "typeorm";

@Entity({ name: "permissions" })
@Index("uq_permissions_code_ci", { synchronize: false })
@Check("ck_permissions_code_nonblank", "btrim(code) <> ''")
export class PermissionOrmEntity {
  @PrimaryColumn({
    name: "id",
    type: "uuid",
    primaryKeyConstraintName: "pk_permissions",
  })
  id!: string;

  @Column({ name: "code", type: "varchar", length: 120 })
  code!: string;

  @Column({ name: "description", type: "text", nullable: true })
  description!: string | null;

  @Column({
    name: "created_at",
    type: "timestamptz",
    default: () => "now()",
  })
  createdAt!: Date;
}
