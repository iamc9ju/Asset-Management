export class BootstrapAdministratorCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BootstrapAdministratorCommandError";
  }
}

export class BootstrapAdministratorInputError extends BootstrapAdministratorCommandError {
  constructor(message: string) {
    super(message);
    this.name = "BootstrapAdministratorInputError";
  }
}

export class SystemAdministratorRoleUnavailableError extends BootstrapAdministratorCommandError {
  constructor() {
    super(
      "The active SYSTEM_ADMIN system role is unavailable. Run the permission and role seed before bootstrapping an administrator.",
    );
    this.name = "SystemAdministratorRoleUnavailableError";
  }
}

export class BootstrapAdministratorEmailConflictError extends BootstrapAdministratorCommandError {
  constructor() {
    super(
      "A user already owns the requested email but is not the bootstrapped administrator. Refusing to elevate an existing user.",
    );
    this.name = "BootstrapAdministratorEmailConflictError";
  }
}

export class BootstrapAdministratorAlreadyExistsError extends BootstrapAdministratorCommandError {
  constructor() {
    super(
      "A different administrator already has the SYSTEM_ADMIN role. Use an authenticated administrator workflow for additional assignments.",
    );
    this.name = "BootstrapAdministratorAlreadyExistsError";
  }
}
