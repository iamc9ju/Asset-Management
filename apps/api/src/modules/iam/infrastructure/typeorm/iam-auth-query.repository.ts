import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import type {
  IamAuthenticationUser,
  IamAuthorizationContext,
  IamAuthQuery,
} from "../../application/ports/iam-auth-query.port";
import type { UserStatus } from "../../domain/user-status";
import { PermissionOrmEntity } from "./entities/permission.orm-entity";
import { RolePermissionOrmEntity } from "./entities/role-permission.orm-entity";
import { RoleOrmEntity } from "./entities/role.orm-entity";
import { UserRoleOrmEntity } from "./entities/user-role.orm-entity";
import { UserOrmEntity } from "./entities/user.orm-entity";

interface AuthorizationRow {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly status: UserStatus;
  readonly permissionVersion: string;
  readonly permissionCode: string | null;
}

@Injectable()
export class TypeOrmIamAuthQueryRepository implements IamAuthQuery {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly users: Repository<UserOrmEntity>,
  ) {}

  async findAuthenticationUserByEmail(
    email: string,
  ): Promise<IamAuthenticationUser | null> {
    const user = await this.users
      .createQueryBuilder("appUser")
      .addSelect("appUser.passwordHash")
      .where("appUser.email = :email", { email })
      .getOne();

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      displayName: user.displayName,
      status: user.status,
      permissionVersion: user.permissionVersion,
    };
  }

  async findAuthorizationContextByUserId(
    userId: string,
  ): Promise<IamAuthorizationContext | null> {
    const rows = await this.users
      .createQueryBuilder("appUser")
      .leftJoin(
        UserRoleOrmEntity,
        "userRole",
        "userRole.userId = appUser.id",
      )
      .leftJoin(
        RoleOrmEntity,
        "role",
        "role.id = userRole.roleId AND role.isActive = :roleIsActive",
        { roleIsActive: true },
      )
      .leftJoin(
        RolePermissionOrmEntity,
        "rolePermission",
        "rolePermission.roleId = role.id",
      )
      .leftJoin(
        PermissionOrmEntity,
        "permission",
        "permission.id = rolePermission.permissionId",
      )
      .select("appUser.id", "userId")
      .addSelect("appUser.email", "email")
      .addSelect("appUser.displayName", "displayName")
      .addSelect("appUser.status", "status")
      .addSelect("appUser.permissionVersion", "permissionVersion")
      .addSelect("permission.code", "permissionCode")
      .where("appUser.id = :userId", { userId })
      .orderBy("permission.code", "ASC", "NULLS LAST")
      .getRawMany<AuthorizationRow>();

    const user = rows[0];

    if (!user) {
      return null;
    }

    const permissionCodes = [
      ...new Set(
        rows.flatMap((row) =>
          row.permissionCode === null ? [] : [row.permissionCode],
        ),
      ),
    ];

    return {
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      permissionVersion: user.permissionVersion,
      permissionCodes,
    };
  }
}
