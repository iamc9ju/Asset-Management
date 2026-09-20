import type { RequestWithId } from "../../../shared/http/request-id/request-id.types";
import type { AuthenticatedIdentity } from "../domain/authenticated-identity";

export interface AuthenticatedRequest extends RequestWithId {
  authenticatedIdentity?: AuthenticatedIdentity;
}
