import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import type {
  AuthEventRepository,
  RecordAuthorizationDeniedInput,
  RecordLoginFailureInput,
  RecordRateLimitExceededInput,
  RecordRetentionCleanupCompletedInput,
} from "../../application/ports/auth-event.port";
import {
  insertAuthorizationDeniedActivity,
  insertLoginFailureActivity,
  insertRateLimitExceededActivity,
  insertRetentionCleanupCompletedActivity,
} from "./auth-activity-log.persistence";

@Injectable()
export class TypeOrmAuthEventRepository implements AuthEventRepository {
  constructor(private readonly dataSource: DataSource) {}

  recordLoginFailure(input: RecordLoginFailureInput): Promise<void> {
    return insertLoginFailureActivity(this.dataSource.manager, input);
  }

  recordRateLimitExceeded(input: RecordRateLimitExceededInput): Promise<void> {
    return insertRateLimitExceededActivity(this.dataSource.manager, input);
  }

  recordAuthorizationDenied(
    input: RecordAuthorizationDeniedInput,
  ): Promise<void> {
    return insertAuthorizationDeniedActivity(this.dataSource.manager, input);
  }

  recordRetentionCleanupCompleted(
    input: RecordRetentionCleanupCompletedInput,
  ): Promise<void> {
    return insertRetentionCleanupCompletedActivity(
      this.dataSource.manager,
      input,
    );
  }
}
