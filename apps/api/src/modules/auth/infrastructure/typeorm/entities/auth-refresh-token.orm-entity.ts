import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from "typeorm";
import { AuthSessionOrmEntity } from "./auth-session.orm-entity";

@Entity({ name: "auth_refresh_tokens" })
@Unique("uq_auth_refresh_tokens_hash", ["tokenHash"])
@Unique("uq_auth_refresh_tokens_id_session", ["id", "sessionId"])
@Unique("uq_auth_refresh_tokens_parent", ["parentTokenId"])
@Unique("uq_auth_refresh_tokens_replacement", ["replacedByTokenId"])
@Index("ix_auth_refresh_tokens_session_issued", {
  synchronize: false,
})
@Index("ix_auth_refresh_tokens_active_expiry", ["expiresAt"], {
  where: "used_at IS NULL AND revoked_at IS NULL",
})
@Check("ck_auth_refresh_tokens_hash", "token_hash ~ '^[0-9a-f]{64}$'")
@Check("ck_auth_refresh_tokens_expiry", "expires_at > issued_at")
@Check("ck_auth_refresh_tokens_used", "used_at IS NULL OR used_at >= issued_at")
@Check(
  "ck_auth_refresh_tokens_revoked",
  "revoked_at IS NULL OR revoked_at >= issued_at",
)
@Check(
  "ck_auth_refresh_tokens_parent_not_self",
  "parent_token_id IS NULL OR parent_token_id <> id",
)
@Check(
  "ck_auth_refresh_tokens_replacement_not_self",
  "replaced_by_token_id IS NULL OR replaced_by_token_id <> id",
)
@Check(
  "ck_auth_refresh_tokens_replacement_used",
  "replaced_by_token_id IS NULL OR used_at IS NOT NULL",
)
export class AuthRefreshTokenOrmEntity {
  @PrimaryColumn({
    name: "id",
    type: "uuid",
    primaryKeyConstraintName: "pk_auth_refresh_tokens",
  })
  id!: string;

  @Column({ name: "session_id", type: "uuid" })
  sessionId!: string;

  @Column({
    name: "parent_token_id",
    type: "uuid",
    nullable: true,
  })
  parentTokenId!: string | null;

  @Column({
    name: "token_hash",
    type: "varchar",
    length: 64,
    select: false,
  })
  tokenHash!: string;

  @Column({
    name: "issued_at",
    type: "timestamptz",
    default: () => "now()",
  })
  issuedAt!: Date;

  @Column({ name: "expires_at", type: "timestamptz" })
  expiresAt!: Date;

  @Column({
    name: "used_at",
    type: "timestamptz",
    nullable: true,
  })
  usedAt!: Date | null;

  @Column({
    name: "revoked_at",
    type: "timestamptz",
    nullable: true,
  })
  revokedAt!: Date | null;

  @Column({
    name: "replaced_by_token_id",
    type: "uuid",
    nullable: true,
  })
  replacedByTokenId!: string | null;

  @Column({ name: "ip_used", type: "inet", nullable: true })
  ipUsed!: string | null;

  @ManyToOne(() => AuthSessionOrmEntity, {
    nullable: false,
    onDelete: "CASCADE",
  })
  @JoinColumn({
    name: "session_id",
    referencedColumnName: "id",
    foreignKeyConstraintName: "fk_auth_refresh_tokens_session",
  })
  session!: AuthSessionOrmEntity;

  @ManyToOne(() => AuthRefreshTokenOrmEntity, {
    nullable: true,
    onDelete: "RESTRICT",
  })
  @JoinColumn([
    {
      name: "parent_token_id",
      referencedColumnName: "id",
      foreignKeyConstraintName: "fk_auth_refresh_tokens_parent",
    },
    {
      name: "session_id",
      referencedColumnName: "sessionId",
    },
  ])
  parentToken!: AuthRefreshTokenOrmEntity | null;

  @ManyToOne(() => AuthRefreshTokenOrmEntity, {
    nullable: true,
    onDelete: "RESTRICT",
  })
  @JoinColumn([
    {
      name: "replaced_by_token_id",
      referencedColumnName: "id",
      foreignKeyConstraintName: "fk_auth_refresh_tokens_replacement",
    },
    {
      name: "session_id",
      referencedColumnName: "sessionId",
    },
  ])
  replacementToken!: AuthRefreshTokenOrmEntity | null;
}
