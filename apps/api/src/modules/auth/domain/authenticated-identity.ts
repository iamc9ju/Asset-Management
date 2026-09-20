import { USER_STATUS } from "../../iam/domain/user-status";

export interface AuthenticatedIdentity {
  readonly userId: string;
  readonly sessionId: string;
  readonly displayName: string;
  readonly status: typeof USER_STATUS.ACTIVE;
  readonly permissionVersion: string;
  readonly permissionCodes: readonly string[];
}
