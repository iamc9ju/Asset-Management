import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import type {
  AuthEventRepository,
  RecordLoginFailureInput,
} from "../../application/ports/auth-event.port";
import { insertLoginFailureActivity } from "./auth-activity-log.persistence";

@Injectable()
export class TypeOrmAuthEventRepository implements AuthEventRepository {
  constructor(private readonly dataSource: DataSource) {}

  recordLoginFailure(input: RecordLoginFailureInput): Promise<void> {
    return insertLoginFailureActivity(this.dataSource.manager, input);
  }
}
