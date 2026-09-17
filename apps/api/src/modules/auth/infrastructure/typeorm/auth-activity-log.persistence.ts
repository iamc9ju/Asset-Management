import { randomUUID } from "node:crypto";
import type { EntityManager } from "typeorm";
import {
  AUTH_EVENT_ACTION,
  type LoginFailureReason,
} from "../../application/ports/auth-event.port";
import type { LoginClientContext } from "../../application/ports/auth-session-repository.port";

const ACTIVITY_ACTOR_TYPE = {
  USER: "USER",
  ANONYMOUS: "ANONYMOUS",
} as const;

const ACTIVITY_OUTCOME = {
  SUCCESS: "SUCCESS",
  DENIED: "DENIED",
} as const;

const ACTIVITY_ENTITY_TYPE = {
  AUTHENTICATION: "AUTHENTICATION",
  AUTH_SESSION: "AUTH_SESSION",
} as const;

interface InsertLoginSuccessActivityInput {
  readonly userId: string;
  readonly sessionId: string;
  readonly occurredAt: Date;
  readonly client: LoginClientContext;
}

interface InsertLoginFailureActivityInput {
  readonly targetUserId: string | null;
  readonly reason: LoginFailureReason;
  readonly occurredAt: Date;
  readonly client: LoginClientContext;
}

export async function insertLoginSuccessActivity(
  manager: EntityManager,
  input: InsertLoginSuccessActivityInput,
): Promise<void> {
  await insertActivity(manager, {
    actorUserId: input.userId,
    actorType: ACTIVITY_ACTOR_TYPE.USER,
    action: AUTH_EVENT_ACTION.LOGIN_SUCCEEDED,
    entityType: ACTIVITY_ENTITY_TYPE.AUTH_SESSION,
    entityId: input.sessionId,
    metadata: {},
    outcome: ACTIVITY_OUTCOME.SUCCESS,
    occurredAt: input.occurredAt,
    client: input.client,
  });
}

export async function insertLoginFailureActivity(
  manager: EntityManager,
  input: InsertLoginFailureActivityInput,
): Promise<void> {
  await insertActivity(manager, {
    actorUserId: null,
    actorType: ACTIVITY_ACTOR_TYPE.ANONYMOUS,
    action: AUTH_EVENT_ACTION.LOGIN_FAILED,
    entityType: ACTIVITY_ENTITY_TYPE.AUTHENTICATION,
    entityId: input.targetUserId,
    metadata: { reason: input.reason },
    outcome: ACTIVITY_OUTCOME.DENIED,
    occurredAt: input.occurredAt,
    client: input.client,
  });
}

interface InsertActivityInput {
  readonly actorUserId: string | null;
  readonly actorType: (typeof ACTIVITY_ACTOR_TYPE)[keyof typeof ACTIVITY_ACTOR_TYPE];
  readonly action: (typeof AUTH_EVENT_ACTION)[keyof typeof AUTH_EVENT_ACTION];
  readonly entityType: (typeof ACTIVITY_ENTITY_TYPE)[keyof typeof ACTIVITY_ENTITY_TYPE];
  readonly entityId: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly outcome: (typeof ACTIVITY_OUTCOME)[keyof typeof ACTIVITY_OUTCOME];
  readonly occurredAt: Date;
  readonly client: LoginClientContext;
}

async function insertActivity(
  manager: EntityManager,
  input: InsertActivityInput,
): Promise<void> {
  await manager.query(
    `
      INSERT INTO activity_logs (
        id,
        occurred_at,
        actor_user_id,
        actor_type,
        action,
        entity_type,
        entity_id,
        metadata,
        request_id,
        ip_address,
        user_agent,
        outcome
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12)
    `,
    [
      randomUUID(),
      input.occurredAt,
      input.actorUserId,
      input.actorType,
      input.action,
      input.entityType,
      input.entityId,
      JSON.stringify(input.metadata),
      input.client.requestId,
      input.client.ipAddress,
      input.client.userAgent,
      input.outcome,
    ],
  );
}
