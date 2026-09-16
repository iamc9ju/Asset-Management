import {
  Check,
  Column,
  Entity,
  Index,
  PrimaryColumn,
} from "typeorm";
import {
  USER_STATUS,
  type UserStatus,
} from "../../../domain/user-status";

@Entity({ name: "users" })
@Index("uq_users_email_ci", { synchronize: false })
@Index("uq_users_employee_code_ci", { synchronize: false })
@Index("ix_users_status", ["status"])
@Check(
  "ck_users_employee_code_nonblank",
  "employee_code IS NULL OR btrim(employee_code) <> ''",
)
@Check("ck_users_email_nonblank", "btrim(email::text) <> ''")
@Check("ck_users_display_name_nonblank", "btrim(display_name) <> ''")
@Check(
  "ck_users_status",
  "status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')",
)
@Check("ck_users_permission_version_positive", "permission_version > 0")
@Check("ck_users_version_positive", "version > 0")
export class UserOrmEntity {
  @PrimaryColumn({
    name: "id",
    type: "uuid",
    primaryKeyConstraintName: "pk_users",
  })
  id!: string;

  @Column({
    name: "employee_code",
    type: "varchar",
    length: 50,
    nullable: true,
  })
  employeeCode!: string | null;

  @Column({ name: "email", type: "citext" })
  email!: string;

  @Column({
    name: "password_hash",
    type: "varchar",
    length: 255,
    select: false,
  })
  passwordHash!: string;

  @Column({ name: "display_name", type: "varchar", length: 200 })
  displayName!: string;

  @Column({
    name: "status",
    type: "varchar",
    length: 20,
    default: USER_STATUS.ACTIVE,
  })
  status!: UserStatus;

  @Column({
    name: "permission_version",
    type: "bigint",
    default: 1,
  })
  permissionVersion!: string;

  @Column({ name: "version", type: "bigint", default: 1 })
  version!: string;

  @Column({
    name: "last_login_at",
    type: "timestamptz",
    nullable: true,
  })
  lastLoginAt!: Date | null;

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
