import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IAM_AUTH_QUERY } from "./application/ports/iam-auth-query.port";
import { PermissionOrmEntity } from "./infrastructure/typeorm/entities/permission.orm-entity";
import { RolePermissionOrmEntity } from "./infrastructure/typeorm/entities/role-permission.orm-entity";
import { RoleOrmEntity } from "./infrastructure/typeorm/entities/role.orm-entity";
import { UserRoleOrmEntity } from "./infrastructure/typeorm/entities/user-role.orm-entity";
import { UserOrmEntity } from "./infrastructure/typeorm/entities/user.orm-entity";
import { TypeOrmIamAuthQueryRepository } from "./infrastructure/typeorm/iam-auth-query.repository";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserOrmEntity,
      RoleOrmEntity,
      PermissionOrmEntity,
      UserRoleOrmEntity,
      RolePermissionOrmEntity,
    ]),
  ],
  providers: [
    {
      provide: IAM_AUTH_QUERY,
      useClass: TypeOrmIamAuthQueryRepository,
    },
  ],
  exports: [IAM_AUTH_QUERY],
})
export class IamModule {}
