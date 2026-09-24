import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { UserOrmEntity } from "../../../../iam/infrastructure/typeorm/entities/user.orm-entity";

@Entity({ name: "auth_sessions" })
@Index("ix_auth_sessions_user_active", ["userId"], {
  where: "revoked_at IS NULL",
})
@Index("ix_auth_sessions_idle_expires_at", ["idleExpiresAt"])
@Index("ix_auth_sessions_expires_at", ["expiresAt"])
@Check(
  "ck_auth_sessions_device_label_nonblank",
  "device_label IS NULL OR btrim(device_label) <> ''",
)
@Check("ck_auth_sessions_idle_expiry", "idle_expires_at > created_at")
@Check("ck_auth_sessions_absolute_expiry", "expires_at > created_at")
@Check("ck_auth_sessions_idle_before_absolute", "idle_expires_at <= expires_at")
@Check(
  "ck_auth_sessions_last_used",
  "last_used_at IS NULL OR last_used_at >= created_at",
)
@Check(
  "ck_auth_sessions_revocation",
  "(revoked_at IS NULL AND revoke_reason IS NULL) OR (revoked_at IS NOT NULL AND revoke_reason IS NOT NULL AND btrim(revoke_reason) <> '')",
)
export class AuthSessionOrmEntity {
  @PrimaryColumn({
    name: "id",
    type: "uuid",
    primaryKeyConstraintName: "pk_auth_sessions",
  })
  id!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({
    name: "device_label",
    type: "varchar",
    length: 200,
    nullable: true,
  })
  deviceLabel!: string | null;

  @Column({ name: "ip_created", type: "inet", nullable: true })
  ipCreated!: string | null;

  @Column({
    name: "user_agent_created",
    type: "text",
    nullable: true,
  })
  userAgentCreated!: string | null;

  @Column({ name: "idle_expires_at", type: "timestamptz" })
  idleExpiresAt!: Date;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt!: Date;

  @Column({
    name: "last_used_at",
    type: "timestamptz",
    nullable: true,
  })
  lastUsedAt!: Date | null;

  @Column({
    name: "revoked_at",
    type: "timestamptz",
    nullable: true,
  })
  revokedAt!: Date | null;

  @Column({
    name: "revoke_reason",
    type: "varchar",
    length: 100,
    nullable: true,
  })
  revokeReason!: string | null;

  @Column({
    name: "created_at",
    type: "timestamptz",
    default: () => "now()",
  })
  createdAt!: Date;

  @ManyToOne(() => UserOrmEntity, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({
    name: "user_id",
    referencedColumnName: "id",
    foreignKeyConstraintName: "fk_auth_sessions_user",
  })
  user!: UserOrmEntity;
}
