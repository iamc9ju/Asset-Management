import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateInitialSchema1789236000000 implements MigrationInterface {
  public readonly name = "CreateInitialSchema1789236000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS citext;
      CREATE EXTENSION IF NOT EXISTS btree_gist;

      CREATE TABLE users (
        id uuid NOT NULL,
        employee_code varchar(50),
        email citext NOT NULL,
        password_hash varchar(255) NOT NULL,
        display_name varchar(200) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'ACTIVE',
        permission_version bigint NOT NULL DEFAULT 1,
        version bigint NOT NULL DEFAULT 1,
        last_login_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_users PRIMARY KEY (id),
        CONSTRAINT ck_users_employee_code_nonblank CHECK (
          employee_code IS NULL OR btrim(employee_code) <> ''
        ),
        CONSTRAINT ck_users_email_nonblank CHECK (btrim(email::text) <> ''),
        CONSTRAINT ck_users_display_name_nonblank CHECK (btrim(display_name) <> ''),
        CONSTRAINT ck_users_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
        CONSTRAINT ck_users_permission_version_positive CHECK (permission_version > 0),
        CONSTRAINT ck_users_version_positive CHECK (version > 0)
      );

      CREATE UNIQUE INDEX uq_users_email_ci ON users (lower(email::text));
      CREATE UNIQUE INDEX uq_users_employee_code_ci
        ON users (lower(employee_code))
        WHERE employee_code IS NOT NULL;
      CREATE INDEX ix_users_status ON users (status);

      CREATE TABLE roles (
        id uuid NOT NULL,
        code varchar(80) NOT NULL,
        name varchar(120) NOT NULL,
        description text,
        is_system boolean NOT NULL DEFAULT false,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_roles PRIMARY KEY (id),
        CONSTRAINT ck_roles_code_nonblank CHECK (btrim(code) <> ''),
        CONSTRAINT ck_roles_name_nonblank CHECK (btrim(name) <> '')
      );

      CREATE UNIQUE INDEX uq_roles_code_ci ON roles (lower(code));
      CREATE INDEX ix_roles_is_active ON roles (is_active);

      CREATE TABLE permissions (
        id uuid NOT NULL,
        code varchar(120) NOT NULL,
        description text,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_permissions PRIMARY KEY (id),
        CONSTRAINT ck_permissions_code_nonblank CHECK (btrim(code) <> '')
      );

      CREATE UNIQUE INDEX uq_permissions_code_ci ON permissions (lower(code));

      CREATE TABLE user_roles (
        user_id uuid NOT NULL,
        role_id uuid NOT NULL,
        granted_by uuid,
        granted_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_user_roles PRIMARY KEY (user_id, role_id),
        CONSTRAINT fk_user_roles_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_user_roles_role
          FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
        CONSTRAINT fk_user_roles_granted_by
          FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX ix_user_roles_role_id ON user_roles (role_id);

      CREATE TABLE role_permissions (
        role_id uuid NOT NULL,
        permission_id uuid NOT NULL,
        granted_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_role_permissions PRIMARY KEY (role_id, permission_id),
        CONSTRAINT fk_role_permissions_role
          FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        CONSTRAINT fk_role_permissions_permission
          FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE RESTRICT
      );

      CREATE INDEX ix_role_permissions_permission_id
        ON role_permissions (permission_id);

      CREATE TABLE auth_sessions (
        id uuid NOT NULL,
        user_id uuid NOT NULL,
        device_label varchar(200),
        ip_created inet,
        user_agent_created text,
        idle_expires_at timestamptz NOT NULL,
        expires_at timestamptz NOT NULL,
        last_used_at timestamptz,
        revoked_at timestamptz,
        revoke_reason varchar(100),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_auth_sessions PRIMARY KEY (id),
        CONSTRAINT fk_auth_sessions_user
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT ck_auth_sessions_device_label_nonblank CHECK (
          device_label IS NULL OR btrim(device_label) <> ''
        ),
        CONSTRAINT ck_auth_sessions_idle_expiry CHECK (idle_expires_at > created_at),
        CONSTRAINT ck_auth_sessions_absolute_expiry CHECK (expires_at > created_at),
        CONSTRAINT ck_auth_sessions_idle_before_absolute CHECK (idle_expires_at <= expires_at),
        CONSTRAINT ck_auth_sessions_last_used CHECK (
          last_used_at IS NULL OR last_used_at >= created_at
        ),
        CONSTRAINT ck_auth_sessions_revocation CHECK (
          (revoked_at IS NULL AND revoke_reason IS NULL)
          OR (
            revoked_at IS NOT NULL
            AND revoke_reason IS NOT NULL
            AND btrim(revoke_reason) <> ''
          )
        )
      );

      CREATE INDEX ix_auth_sessions_user_active
        ON auth_sessions (user_id)
        WHERE revoked_at IS NULL;
      CREATE INDEX ix_auth_sessions_idle_expires_at ON auth_sessions (idle_expires_at);
      CREATE INDEX ix_auth_sessions_expires_at ON auth_sessions (expires_at);

      CREATE TABLE auth_refresh_tokens (
        id uuid NOT NULL,
        session_id uuid NOT NULL,
        parent_token_id uuid,
        token_hash varchar(64) NOT NULL,
        issued_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        revoked_at timestamptz,
        replaced_by_token_id uuid,
        ip_used inet,
        CONSTRAINT pk_auth_refresh_tokens PRIMARY KEY (id),
        CONSTRAINT uq_auth_refresh_tokens_hash UNIQUE (token_hash),
        CONSTRAINT uq_auth_refresh_tokens_id_session UNIQUE (id, session_id),
        CONSTRAINT uq_auth_refresh_tokens_parent UNIQUE (parent_token_id),
        CONSTRAINT uq_auth_refresh_tokens_replacement UNIQUE (replaced_by_token_id),
        CONSTRAINT fk_auth_refresh_tokens_session
          FOREIGN KEY (session_id) REFERENCES auth_sessions(id) ON DELETE CASCADE,
        CONSTRAINT fk_auth_refresh_tokens_parent
          FOREIGN KEY (parent_token_id, session_id)
          REFERENCES auth_refresh_tokens(id, session_id) ON DELETE RESTRICT,
        CONSTRAINT fk_auth_refresh_tokens_replacement
          FOREIGN KEY (replaced_by_token_id, session_id)
          REFERENCES auth_refresh_tokens(id, session_id) ON DELETE RESTRICT,
        CONSTRAINT ck_auth_refresh_tokens_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
        CONSTRAINT ck_auth_refresh_tokens_expiry CHECK (expires_at > issued_at),
        CONSTRAINT ck_auth_refresh_tokens_used CHECK (used_at IS NULL OR used_at >= issued_at),
        CONSTRAINT ck_auth_refresh_tokens_revoked CHECK (
          revoked_at IS NULL OR revoked_at >= issued_at
        ),
        CONSTRAINT ck_auth_refresh_tokens_parent_not_self CHECK (
          parent_token_id IS NULL OR parent_token_id <> id
        ),
        CONSTRAINT ck_auth_refresh_tokens_replacement_not_self CHECK (
          replaced_by_token_id IS NULL OR replaced_by_token_id <> id
        ),
        CONSTRAINT ck_auth_refresh_tokens_replacement_used CHECK (
          replaced_by_token_id IS NULL OR used_at IS NOT NULL
        )
      );

      CREATE INDEX ix_auth_refresh_tokens_session_issued
        ON auth_refresh_tokens (session_id, issued_at DESC);
      CREATE INDEX ix_auth_refresh_tokens_active_expiry
        ON auth_refresh_tokens (expires_at)
        WHERE used_at IS NULL AND revoked_at IS NULL;

      CREATE TABLE asset_categories (
        id uuid NOT NULL,
        parent_id uuid,
        code varchar(50) NOT NULL,
        name varchar(150) NOT NULL,
        description text,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_asset_categories PRIMARY KEY (id),
        CONSTRAINT fk_asset_categories_parent
          FOREIGN KEY (parent_id) REFERENCES asset_categories(id) ON DELETE RESTRICT,
        CONSTRAINT ck_asset_categories_parent_not_self CHECK (
          parent_id IS NULL OR parent_id <> id
        ),
        CONSTRAINT ck_asset_categories_code_nonblank CHECK (btrim(code) <> ''),
        CONSTRAINT ck_asset_categories_name_nonblank CHECK (btrim(name) <> '')
      );

      CREATE UNIQUE INDEX uq_asset_categories_code_ci
        ON asset_categories (lower(code));
      CREATE INDEX ix_asset_categories_parent_id ON asset_categories (parent_id);
      CREATE INDEX ix_asset_categories_is_active ON asset_categories (is_active);

      CREATE TABLE locations (
        id uuid NOT NULL,
        parent_id uuid,
        code varchar(80) NOT NULL,
        name varchar(180) NOT NULL,
        location_type varchar(30) NOT NULL DEFAULT 'OTHER',
        is_active boolean NOT NULL DEFAULT true,
        path_cache text,
        version bigint NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_locations PRIMARY KEY (id),
        CONSTRAINT fk_locations_parent
          FOREIGN KEY (parent_id) REFERENCES locations(id) ON DELETE RESTRICT,
        CONSTRAINT ck_locations_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id),
        CONSTRAINT ck_locations_code_nonblank CHECK (btrim(code) <> ''),
        CONSTRAINT ck_locations_name_nonblank CHECK (btrim(name) <> ''),
        CONSTRAINT ck_locations_type CHECK (
          location_type IN (
            'BRANCH', 'BUILDING', 'FLOOR', 'ROOM', 'AREA', 'DESK', 'WAREHOUSE', 'OTHER'
          )
        ),
        CONSTRAINT ck_locations_version_positive CHECK (version > 0)
      );

      CREATE UNIQUE INDEX uq_locations_code_ci ON locations (lower(code));
      CREATE INDEX ix_locations_parent_id ON locations (parent_id);
      CREATE INDEX ix_locations_is_active ON locations (is_active);

      CREATE TABLE assets (
        id uuid NOT NULL,
        asset_code varchar(80) NOT NULL,
        name varchar(200) NOT NULL,
        category_id uuid NOT NULL,
        serial_number varchar(150),
        description text,
        current_location_id uuid NOT NULL,
        lifecycle_status varchar(20) NOT NULL DEFAULT 'DRAFT',
        condition_status varchar(20) NOT NULL DEFAULT 'UNKNOWN',
        acquisition_date date,
        acquisition_cost numeric(19, 4),
        currency_code char(3),
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        version bigint NOT NULL DEFAULT 1,
        created_by uuid NOT NULL,
        updated_by uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_assets PRIMARY KEY (id),
        CONSTRAINT fk_assets_category
          FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE RESTRICT,
        CONSTRAINT fk_assets_current_location
          FOREIGN KEY (current_location_id) REFERENCES locations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_assets_created_by
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_assets_updated_by
          FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT ck_assets_code_nonblank CHECK (btrim(asset_code) <> ''),
        CONSTRAINT ck_assets_name_nonblank CHECK (btrim(name) <> ''),
        CONSTRAINT ck_assets_lifecycle CHECK (
          lifecycle_status IN ('DRAFT', 'ACTIVE', 'RETIRED', 'DISPOSED')
        ),
        CONSTRAINT ck_assets_condition CHECK (
          condition_status IN ('UNKNOWN', 'GOOD', 'DAMAGED', 'IN_REPAIR')
        ),
        CONSTRAINT ck_assets_cost_currency CHECK (
          (acquisition_cost IS NULL AND currency_code IS NULL)
          OR (
            acquisition_cost IS NOT NULL
            AND acquisition_cost >= 0
            AND currency_code ~ '^[A-Z]{3}$'
          )
        ),
        CONSTRAINT ck_assets_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
        CONSTRAINT ck_assets_version_positive CHECK (version > 0)
      );

      CREATE UNIQUE INDEX uq_assets_asset_code_ci ON assets (lower(asset_code));
      CREATE INDEX ix_assets_category_id ON assets (category_id);
      CREATE INDEX ix_assets_current_location_id ON assets (current_location_id);
      CREATE INDEX ix_assets_lifecycle_status ON assets (lifecycle_status);
      CREATE INDEX ix_assets_condition_status ON assets (condition_status);
      CREATE INDEX ix_assets_serial_number ON assets (serial_number);
      CREATE INDEX ix_assets_created_at ON assets (created_at DESC);

      CREATE TABLE asset_lifecycle_transitions (
        id uuid NOT NULL,
        asset_id uuid NOT NULL,
        from_status varchar(20),
        to_status varchar(20) NOT NULL,
        reason text,
        occurred_at timestamptz NOT NULL DEFAULT now(),
        actor_user_id uuid,
        request_id uuid NOT NULL,
        CONSTRAINT pk_asset_lifecycle_transitions PRIMARY KEY (id),
        CONSTRAINT fk_asset_lifecycle_transitions_asset
          FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT,
        CONSTRAINT fk_asset_lifecycle_transitions_actor
          FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT ck_asset_lifecycle_transitions_from CHECK (
          from_status IS NULL OR from_status IN ('DRAFT', 'ACTIVE', 'RETIRED', 'DISPOSED')
        ),
        CONSTRAINT ck_asset_lifecycle_transitions_to CHECK (
          to_status IN ('DRAFT', 'ACTIVE', 'RETIRED', 'DISPOSED')
        ),
        CONSTRAINT ck_asset_lifecycle_transitions_changed CHECK (
          from_status IS NULL OR from_status <> to_status
        ),
        CONSTRAINT ck_asset_lifecycle_transitions_reason CHECK (
          (
            to_status NOT IN ('RETIRED', 'DISPOSED')
            AND COALESCE(from_status, '') NOT IN ('RETIRED', 'DISPOSED')
          )
          OR (reason IS NOT NULL AND btrim(reason) <> '')
        )
      );

      CREATE INDEX ix_asset_lifecycle_transitions_timeline
        ON asset_lifecycle_transitions (asset_id, occurred_at DESC, id DESC);
      CREATE INDEX ix_asset_lifecycle_transitions_request_id
        ON asset_lifecycle_transitions (request_id);

      CREATE TABLE asset_identifiers (
        id uuid NOT NULL,
        asset_id uuid NOT NULL,
        identifier_type varchar(20) NOT NULL,
        token varchar(255) NOT NULL,
        display_value varchar(120),
        status varchar(20) NOT NULL DEFAULT 'ACTIVE',
        valid_from timestamptz NOT NULL DEFAULT now(),
        valid_to timestamptz,
        replaced_by_id uuid,
        created_by uuid NOT NULL,
        revoke_reason text,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_asset_identifiers PRIMARY KEY (id),
        CONSTRAINT uq_asset_identifiers_token UNIQUE (token),
        CONSTRAINT fk_asset_identifiers_asset
          FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT,
        CONSTRAINT fk_asset_identifiers_replacement
          FOREIGN KEY (replaced_by_id) REFERENCES asset_identifiers(id) ON DELETE RESTRICT,
        CONSTRAINT fk_asset_identifiers_created_by
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT ck_asset_identifiers_type CHECK (
          identifier_type IN ('BARCODE', 'QR', 'RFID')
        ),
        CONSTRAINT ck_asset_identifiers_token_nonblank CHECK (btrim(token) <> ''),
        CONSTRAINT ck_asset_identifiers_status CHECK (
          status IN ('ACTIVE', 'REVOKED', 'REPLACED')
        ),
        CONSTRAINT ck_asset_identifiers_validity CHECK (
          valid_to IS NULL OR valid_to >= valid_from
        ),
        CONSTRAINT ck_asset_identifiers_status_period CHECK (
          (status = 'ACTIVE' AND valid_to IS NULL AND revoke_reason IS NULL)
          OR (
            status IN ('REVOKED', 'REPLACED')
            AND valid_to IS NOT NULL
            AND revoke_reason IS NOT NULL
            AND btrim(revoke_reason) <> ''
          )
        ),
        CONSTRAINT ck_asset_identifiers_replacement_not_self CHECK (
          replaced_by_id IS NULL OR replaced_by_id <> id
        ),
        CONSTRAINT ck_asset_identifiers_replacement_state CHECK (
          (status = 'REPLACED' AND replaced_by_id IS NOT NULL)
          OR (status <> 'REPLACED' AND replaced_by_id IS NULL)
        )
      );

      CREATE UNIQUE INDEX uq_asset_identifiers_one_active_per_type
        ON asset_identifiers (asset_id, identifier_type)
        WHERE status = 'ACTIVE';
      CREATE INDEX ix_asset_identifiers_asset_id ON asset_identifiers (asset_id);

      CREATE TABLE asset_assignments (
        id uuid NOT NULL,
        asset_id uuid NOT NULL,
        assignee_user_id uuid NOT NULL,
        started_at timestamptz NOT NULL DEFAULT now(),
        ended_at timestamptz,
        assigned_by uuid NOT NULL,
        ended_by uuid,
        reason text,
        end_reason text,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_asset_assignments PRIMARY KEY (id),
        CONSTRAINT fk_asset_assignments_asset
          FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT,
        CONSTRAINT fk_asset_assignments_assignee
          FOREIGN KEY (assignee_user_id) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_asset_assignments_assigned_by
          FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_asset_assignments_ended_by
          FOREIGN KEY (ended_by) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT ck_asset_assignments_period CHECK (
          ended_at IS NULL OR ended_at >= started_at
        ),
        CONSTRAINT ck_asset_assignments_end_fields CHECK (
          (ended_at IS NULL AND ended_by IS NULL AND end_reason IS NULL)
          OR (
            ended_at IS NOT NULL
            AND end_reason IS NOT NULL
            AND btrim(end_reason) <> ''
          )
        ),
        CONSTRAINT ex_asset_assignments_no_overlap EXCLUDE USING gist (
          asset_id WITH =,
          tstzrange(started_at, COALESCE(ended_at, 'infinity'::timestamptz), '[)') WITH &&
        )
      );

      CREATE UNIQUE INDEX uq_asset_assignments_one_active
        ON asset_assignments (asset_id)
        WHERE ended_at IS NULL;
      CREATE INDEX ix_asset_assignments_asset_timeline
        ON asset_assignments (asset_id, started_at DESC);
      CREATE INDEX ix_asset_assignments_assignee_active
        ON asset_assignments (assignee_user_id)
        WHERE ended_at IS NULL;

      CREATE TABLE asset_movements (
        id uuid NOT NULL,
        asset_id uuid NOT NULL,
        from_location_id uuid,
        to_location_id uuid NOT NULL,
        movement_type varchar(20) NOT NULL DEFAULT 'TRANSFER',
        effective_at timestamptz NOT NULL DEFAULT now(),
        recorded_at timestamptz NOT NULL DEFAULT now(),
        moved_by uuid NOT NULL,
        reason text,
        request_id uuid NOT NULL,
        CONSTRAINT pk_asset_movements PRIMARY KEY (id),
        CONSTRAINT uq_asset_movements_request_id UNIQUE (request_id),
        CONSTRAINT fk_asset_movements_asset
          FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT,
        CONSTRAINT fk_asset_movements_from_location
          FOREIGN KEY (from_location_id) REFERENCES locations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_asset_movements_to_location
          FOREIGN KEY (to_location_id) REFERENCES locations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_asset_movements_moved_by
          FOREIGN KEY (moved_by) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT ck_asset_movements_type CHECK (
          movement_type IN ('INITIAL', 'TRANSFER', 'RETURN', 'CORRECTION', 'DISPOSAL')
        ),
        CONSTRAINT ck_asset_movements_locations CHECK (
          from_location_id IS NULL OR from_location_id <> to_location_id
        ),
        CONSTRAINT ck_asset_movements_initial_source CHECK (
          (movement_type = 'INITIAL' AND from_location_id IS NULL)
          OR (movement_type <> 'INITIAL' AND from_location_id IS NOT NULL)
        ),
        CONSTRAINT ck_asset_movements_reason CHECK (
          movement_type NOT IN ('CORRECTION', 'DISPOSAL')
          OR (reason IS NOT NULL AND btrim(reason) <> '')
        )
      );

      CREATE INDEX ix_asset_movements_asset_timeline
        ON asset_movements (asset_id, effective_at DESC, recorded_at DESC, id DESC);
      CREATE INDEX ix_asset_movements_destination_timeline
        ON asset_movements (to_location_id, effective_at DESC);

      CREATE TABLE audit_campaigns (
        id uuid NOT NULL,
        code varchar(60) NOT NULL,
        name varchar(200) NOT NULL,
        description text,
        starts_at timestamptz NOT NULL,
        ends_at timestamptz NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'DRAFT',
        snapshot_at timestamptz,
        submitted_at timestamptz,
        finalized_at timestamptz,
        finalized_by uuid,
        open_issue_acknowledgement text,
        total_assets integer NOT NULL DEFAULT 0,
        observed_assets integer NOT NULL DEFAULT 0,
        not_found_assets integer NOT NULL DEFAULT 0,
        version bigint NOT NULL DEFAULT 1,
        created_by uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_audit_campaigns PRIMARY KEY (id),
        CONSTRAINT fk_audit_campaigns_finalized_by
          FOREIGN KEY (finalized_by) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_audit_campaigns_created_by
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT ck_audit_campaigns_code_nonblank CHECK (btrim(code) <> ''),
        CONSTRAINT ck_audit_campaigns_name_nonblank CHECK (btrim(name) <> ''),
        CONSTRAINT ck_audit_campaigns_period CHECK (ends_at >= starts_at),
        CONSTRAINT ck_audit_campaigns_status CHECK (
          status IN ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'SUBMITTED', 'FINALIZED', 'CANCELLED')
        ),
        CONSTRAINT ck_audit_campaigns_snapshot_state CHECK (
          status IN ('DRAFT', 'CANCELLED') OR snapshot_at IS NOT NULL
        ),
        CONSTRAINT ck_audit_campaigns_submission_state CHECK (
          status NOT IN ('SUBMITTED', 'FINALIZED') OR submitted_at IS NOT NULL
        ),
        CONSTRAINT ck_audit_campaigns_finalization_state CHECK (
          (status = 'FINALIZED' AND finalized_at IS NOT NULL AND finalized_by IS NOT NULL)
          OR (status <> 'FINALIZED' AND finalized_at IS NULL AND finalized_by IS NULL)
        ),
        CONSTRAINT ck_audit_campaigns_counts CHECK (
          total_assets >= 0
          AND observed_assets >= 0
          AND not_found_assets >= 0
          AND observed_assets + not_found_assets <= total_assets
        ),
        CONSTRAINT ck_audit_campaigns_version_positive CHECK (version > 0)
      );

      CREATE UNIQUE INDEX uq_audit_campaigns_code_ci ON audit_campaigns (lower(code));
      CREATE INDEX ix_audit_campaigns_status_dates
        ON audit_campaigns (status, starts_at, ends_at);
      CREATE INDEX ix_audit_campaigns_created_by ON audit_campaigns (created_by);

      CREATE TABLE audit_campaign_transitions (
        id uuid NOT NULL,
        campaign_id uuid NOT NULL,
        from_status varchar(20),
        to_status varchar(20) NOT NULL,
        reason text,
        actor_user_id uuid,
        occurred_at timestamptz NOT NULL DEFAULT now(),
        request_id uuid NOT NULL,
        CONSTRAINT pk_audit_campaign_transitions PRIMARY KEY (id),
        CONSTRAINT fk_audit_campaign_transitions_campaign
          FOREIGN KEY (campaign_id) REFERENCES audit_campaigns(id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_campaign_transitions_actor
          FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT ck_audit_campaign_transitions_from CHECK (
          from_status IS NULL
          OR from_status IN (
            'DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'SUBMITTED', 'FINALIZED', 'CANCELLED'
          )
        ),
        CONSTRAINT ck_audit_campaign_transitions_to CHECK (
          to_status IN (
            'DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'SUBMITTED', 'FINALIZED', 'CANCELLED'
          )
        ),
        CONSTRAINT ck_audit_campaign_transitions_changed CHECK (
          from_status IS NULL OR from_status <> to_status
        ),
        CONSTRAINT ck_audit_campaign_transitions_reason CHECK (
          (
            to_status <> 'CANCELLED'
            AND COALESCE(from_status, '') NOT IN ('FINALIZED', 'CANCELLED')
          )
          OR (reason IS NOT NULL AND btrim(reason) <> '')
        )
      );

      CREATE INDEX ix_audit_campaign_transitions_timeline
        ON audit_campaign_transitions (campaign_id, occurred_at DESC, id DESC);
      CREATE INDEX ix_audit_campaign_transitions_request_id
        ON audit_campaign_transitions (request_id);

      CREATE TABLE audit_campaign_locations (
        campaign_id uuid NOT NULL,
        location_id uuid NOT NULL,
        include_descendants boolean NOT NULL DEFAULT true,
        added_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_audit_campaign_locations PRIMARY KEY (campaign_id, location_id),
        CONSTRAINT fk_audit_campaign_locations_campaign
          FOREIGN KEY (campaign_id) REFERENCES audit_campaigns(id) ON DELETE CASCADE,
        CONSTRAINT fk_audit_campaign_locations_location
          FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT
      );

      CREATE INDEX ix_audit_campaign_locations_location_id
        ON audit_campaign_locations (location_id);

      CREATE TABLE audit_campaign_auditors (
        campaign_id uuid NOT NULL,
        auditor_user_id uuid NOT NULL,
        assigned_by uuid NOT NULL,
        assigned_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_audit_campaign_auditors PRIMARY KEY (campaign_id, auditor_user_id),
        CONSTRAINT fk_audit_campaign_auditors_campaign
          FOREIGN KEY (campaign_id) REFERENCES audit_campaigns(id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_campaign_auditors_auditor
          FOREIGN KEY (auditor_user_id) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_campaign_auditors_assigned_by
          FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE RESTRICT
      );

      CREATE INDEX ix_audit_campaign_auditors_user
        ON audit_campaign_auditors (auditor_user_id, campaign_id);

      CREATE TABLE audit_campaign_assets (
        id uuid NOT NULL,
        campaign_id uuid NOT NULL,
        asset_id uuid NOT NULL,
        asset_code_snapshot varchar(80) NOT NULL,
        asset_name_snapshot varchar(200) NOT NULL,
        category_id_snapshot uuid NOT NULL,
        category_name_snapshot varchar(150) NOT NULL,
        expected_location_id uuid NOT NULL,
        expected_location_name varchar(180) NOT NULL,
        expected_assignee_user_id uuid,
        expected_assignee_name varchar(200),
        lifecycle_status_snapshot varchar(20) NOT NULL,
        condition_status_snapshot varchar(20) NOT NULL,
        identifier_id_snapshot uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_audit_campaign_assets PRIMARY KEY (id),
        CONSTRAINT uq_audit_campaign_assets_campaign_asset UNIQUE (campaign_id, asset_id),
        CONSTRAINT uq_audit_campaign_assets_id_campaign UNIQUE (id, campaign_id),
        CONSTRAINT fk_audit_campaign_assets_campaign
          FOREIGN KEY (campaign_id) REFERENCES audit_campaigns(id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_campaign_assets_asset
          FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_campaign_assets_category
          FOREIGN KEY (category_id_snapshot) REFERENCES asset_categories(id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_campaign_assets_location
          FOREIGN KEY (expected_location_id) REFERENCES locations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_campaign_assets_assignee
          FOREIGN KEY (expected_assignee_user_id) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_campaign_assets_identifier
          FOREIGN KEY (identifier_id_snapshot) REFERENCES asset_identifiers(id) ON DELETE RESTRICT,
        CONSTRAINT ck_audit_campaign_assets_code_nonblank CHECK (
          btrim(asset_code_snapshot) <> ''
        ),
        CONSTRAINT ck_audit_campaign_assets_name_nonblank CHECK (
          btrim(asset_name_snapshot) <> ''
        ),
        CONSTRAINT ck_audit_campaign_assets_category_name_nonblank CHECK (
          btrim(category_name_snapshot) <> ''
        ),
        CONSTRAINT ck_audit_campaign_assets_location_name_nonblank CHECK (
          btrim(expected_location_name) <> ''
        ),
        CONSTRAINT ck_audit_campaign_assets_lifecycle CHECK (
          lifecycle_status_snapshot IN ('DRAFT', 'ACTIVE', 'RETIRED', 'DISPOSED')
        ),
        CONSTRAINT ck_audit_campaign_assets_condition CHECK (
          condition_status_snapshot IN ('UNKNOWN', 'GOOD', 'DAMAGED', 'IN_REPAIR')
        )
      );

      CREATE INDEX ix_audit_campaign_assets_location
        ON audit_campaign_assets (campaign_id, expected_location_id);
      CREATE INDEX ix_audit_campaign_assets_assignee
        ON audit_campaign_assets (campaign_id, expected_assignee_user_id);

      CREATE TABLE audit_scan_events (
        id uuid NOT NULL,
        campaign_id uuid NOT NULL,
        campaign_asset_id uuid,
        asset_id uuid,
        identifier_id uuid,
        scanned_value varchar(512) NOT NULL,
        device_id uuid NOT NULL,
        client_event_id uuid NOT NULL,
        auditor_user_id uuid NOT NULL,
        scanned_at timestamptz NOT NULL,
        received_at timestamptz NOT NULL DEFAULT now(),
        observed_location_id uuid,
        observed_assignee_user_id uuid,
        observed_condition varchar(20),
        outcome varchar(30) NOT NULL,
        canonical_observation_changed boolean NOT NULL DEFAULT false,
        note text,
        evidence_uri text,
        request_id uuid NOT NULL,
        CONSTRAINT pk_audit_scan_events PRIMARY KEY (id),
        CONSTRAINT uq_audit_scan_events_client_event UNIQUE (device_id, client_event_id),
        CONSTRAINT uq_audit_scan_events_id_campaign_asset UNIQUE (id, campaign_asset_id),
        CONSTRAINT uq_audit_scan_events_id_campaign UNIQUE (id, campaign_id),
        CONSTRAINT fk_audit_scan_events_campaign
          FOREIGN KEY (campaign_id) REFERENCES audit_campaigns(id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_scan_events_campaign_asset
          FOREIGN KEY (campaign_asset_id, campaign_id)
          REFERENCES audit_campaign_assets(id, campaign_id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_scan_events_asset
          FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_scan_events_identifier
          FOREIGN KEY (identifier_id) REFERENCES asset_identifiers(id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_scan_events_auditor
          FOREIGN KEY (auditor_user_id) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_scan_events_location
          FOREIGN KEY (observed_location_id) REFERENCES locations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_scan_events_assignee
          FOREIGN KEY (observed_assignee_user_id) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT ck_audit_scan_events_value_nonblank CHECK (btrim(scanned_value) <> ''),
        CONSTRAINT ck_audit_scan_events_condition CHECK (
          observed_condition IS NULL
          OR observed_condition IN ('UNKNOWN', 'GOOD', 'DAMAGED', 'IN_REPAIR')
        ),
        CONSTRAINT ck_audit_scan_events_outcome CHECK (
          outcome IN (
            'ACCEPTED',
            'DUPLICATE',
            'RESCAN',
            'UNKNOWN_IDENTIFIER',
            'REVOKED_IDENTIFIER',
            'OUTSIDE_CAMPAIGN',
            'REJECTED_STATE'
          )
        ),
        CONSTRAINT ck_audit_scan_events_times CHECK (
          scanned_at <= received_at + interval '24 hours'
        )
      );

      CREATE INDEX ix_audit_scan_events_campaign_timeline
        ON audit_scan_events (campaign_id, received_at DESC, id DESC);
      CREATE INDEX ix_audit_scan_events_campaign_asset
        ON audit_scan_events (campaign_asset_id, received_at DESC);
      CREATE INDEX ix_audit_scan_events_asset_id ON audit_scan_events (asset_id);
      CREATE INDEX ix_audit_scan_events_identifier_id ON audit_scan_events (identifier_id);
      CREATE INDEX ix_audit_scan_events_outcome ON audit_scan_events (campaign_id, outcome);
      CREATE INDEX ix_audit_scan_events_request_id ON audit_scan_events (request_id);

      CREATE TABLE audit_observations (
        id uuid NOT NULL,
        campaign_asset_id uuid NOT NULL,
        latest_scan_event_id uuid,
        presence_status varchar(20) NOT NULL DEFAULT 'PENDING',
        observed_location_id uuid,
        observed_assignee_user_id uuid,
        observed_condition varchar(20),
        observed_at timestamptz,
        observed_by uuid,
        revision integer NOT NULL DEFAULT 1,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_audit_observations PRIMARY KEY (id),
        CONSTRAINT uq_audit_observations_campaign_asset UNIQUE (campaign_asset_id),
        CONSTRAINT fk_audit_observations_campaign_asset
          FOREIGN KEY (campaign_asset_id) REFERENCES audit_campaign_assets(id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_observations_latest_scan
          FOREIGN KEY (latest_scan_event_id, campaign_asset_id)
          REFERENCES audit_scan_events(id, campaign_asset_id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_observations_location
          FOREIGN KEY (observed_location_id) REFERENCES locations(id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_observations_assignee
          FOREIGN KEY (observed_assignee_user_id) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_observations_observed_by
          FOREIGN KEY (observed_by) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT ck_audit_observations_presence CHECK (
          presence_status IN ('PENDING', 'FOUND', 'NOT_FOUND')
        ),
        CONSTRAINT ck_audit_observations_condition CHECK (
          observed_condition IS NULL
          OR observed_condition IN ('UNKNOWN', 'GOOD', 'DAMAGED', 'IN_REPAIR')
        ),
        CONSTRAINT ck_audit_observations_presence_fields CHECK (
          (
            presence_status = 'PENDING'
            AND latest_scan_event_id IS NULL
            AND observed_at IS NULL
          )
          OR (
            presence_status = 'FOUND'
            AND latest_scan_event_id IS NOT NULL
            AND observed_at IS NOT NULL
          )
          OR (
            presence_status = 'NOT_FOUND'
            AND latest_scan_event_id IS NULL
            AND observed_at IS NULL
          )
        ),
        CONSTRAINT ck_audit_observations_revision_positive CHECK (revision > 0)
      );

      CREATE INDEX ix_audit_observations_presence_status
        ON audit_observations (presence_status);

      CREATE TABLE audit_issues (
        id uuid NOT NULL,
        issue_no varchar(60) NOT NULL,
        campaign_id uuid NOT NULL,
        campaign_asset_id uuid,
        scan_event_id uuid,
        issue_type varchar(30) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'OPEN',
        title varchar(200) NOT NULL,
        description text,
        expected_data jsonb NOT NULL DEFAULT '{}'::jsonb,
        observed_data jsonb NOT NULL DEFAULT '{}'::jsonb,
        assigned_to uuid,
        resolution_note text,
        resolved_by uuid,
        resolved_at timestamptz,
        version bigint NOT NULL DEFAULT 1,
        created_by uuid NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT pk_audit_issues PRIMARY KEY (id),
        CONSTRAINT uq_audit_issues_issue_no UNIQUE (issue_no),
        CONSTRAINT fk_audit_issues_campaign
          FOREIGN KEY (campaign_id) REFERENCES audit_campaigns(id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_issues_campaign_asset
          FOREIGN KEY (campaign_asset_id, campaign_id)
          REFERENCES audit_campaign_assets(id, campaign_id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_issues_scan_event
          FOREIGN KEY (scan_event_id, campaign_id)
          REFERENCES audit_scan_events(id, campaign_id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_issues_assigned_to
          FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_audit_issues_resolved_by
          FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_audit_issues_created_by
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT ck_audit_issues_issue_no_nonblank CHECK (btrim(issue_no) <> ''),
        CONSTRAINT ck_audit_issues_type CHECK (
          issue_type IN (
            'MISSING',
            'WRONG_LOCATION',
            'WRONG_ASSIGNEE',
            'DAMAGED',
            'BARCODE_DAMAGED',
            'UNKNOWN_ASSET',
            'DUPLICATE_TAG',
            'OTHER'
          )
        ),
        CONSTRAINT ck_audit_issues_status CHECK (
          status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED', 'REJECTED')
        ),
        CONSTRAINT ck_audit_issues_title_nonblank CHECK (btrim(title) <> ''),
        CONSTRAINT ck_audit_issues_expected_data_object CHECK (
          jsonb_typeof(expected_data) = 'object'
        ),
        CONSTRAINT ck_audit_issues_observed_data_object CHECK (
          jsonb_typeof(observed_data) = 'object'
        ),
        CONSTRAINT ck_audit_issues_context CHECK (
          campaign_asset_id IS NOT NULL OR scan_event_id IS NOT NULL
        ),
        CONSTRAINT ck_audit_issues_resolution CHECK (
          (
            status NOT IN ('RESOLVED', 'CLOSED')
            AND resolution_note IS NULL
            AND resolved_by IS NULL
            AND resolved_at IS NULL
          )
          OR (
            status IN ('RESOLVED', 'CLOSED')
            AND resolution_note IS NOT NULL
            AND btrim(resolution_note) <> ''
            AND resolved_by IS NOT NULL
            AND resolved_at IS NOT NULL
          )
        ),
        CONSTRAINT ck_audit_issues_version_positive CHECK (version > 0)
      );

      CREATE UNIQUE INDEX uq_audit_issues_open_asset_type
        ON audit_issues (campaign_asset_id, issue_type)
        WHERE campaign_asset_id IS NOT NULL
          AND status IN ('OPEN', 'INVESTIGATING');
      CREATE INDEX ix_audit_issues_review_queue
        ON audit_issues (campaign_id, status, issue_type);
      CREATE INDEX ix_audit_issues_assigned_to
        ON audit_issues (assigned_to, status)
        WHERE assigned_to IS NOT NULL;
      CREATE INDEX ix_audit_issues_scan_event_id ON audit_issues (scan_event_id);

      CREATE TABLE audit_issue_transitions (
        id uuid NOT NULL,
        issue_id uuid NOT NULL,
        from_status varchar(20),
        to_status varchar(20) NOT NULL,
        reason text,
        actor_user_id uuid,
        occurred_at timestamptz NOT NULL DEFAULT now(),
        request_id uuid NOT NULL,
        CONSTRAINT pk_audit_issue_transitions PRIMARY KEY (id),
        CONSTRAINT fk_audit_issue_transitions_issue
          FOREIGN KEY (issue_id) REFERENCES audit_issues(id) ON DELETE RESTRICT,
        CONSTRAINT fk_audit_issue_transitions_actor
          FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT ck_audit_issue_transitions_from CHECK (
          from_status IS NULL
          OR from_status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED', 'REJECTED')
        ),
        CONSTRAINT ck_audit_issue_transitions_to CHECK (
          to_status IN ('OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED', 'REJECTED')
        ),
        CONSTRAINT ck_audit_issue_transitions_changed CHECK (
          from_status IS NULL OR from_status <> to_status
        ),
        CONSTRAINT ck_audit_issue_transitions_reason CHECK (
          (
            to_status NOT IN ('REJECTED', 'INVESTIGATING')
            AND COALESCE(from_status, '') NOT IN ('CLOSED', 'REJECTED')
          )
          OR (reason IS NOT NULL AND btrim(reason) <> '')
        )
      );

      CREATE INDEX ix_audit_issue_transitions_timeline
        ON audit_issue_transitions (issue_id, occurred_at DESC, id DESC);
      CREATE INDEX ix_audit_issue_transitions_request_id
        ON audit_issue_transitions (request_id);

      CREATE TABLE activity_logs (
        id uuid NOT NULL,
        occurred_at timestamptz NOT NULL DEFAULT now(),
        actor_user_id uuid,
        actor_type varchar(20) NOT NULL DEFAULT 'USER',
        action varchar(100) NOT NULL,
        entity_type varchar(80) NOT NULL,
        entity_id uuid,
        before_data jsonb,
        after_data jsonb,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        request_id uuid NOT NULL,
        ip_address inet,
        user_agent text,
        outcome varchar(20) NOT NULL DEFAULT 'SUCCESS',
        CONSTRAINT pk_activity_logs PRIMARY KEY (id),
        CONSTRAINT fk_activity_logs_actor
          FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT ck_activity_logs_actor_type CHECK (
          actor_type IN ('USER', 'SYSTEM', 'SERVICE', 'ANONYMOUS')
        ),
        CONSTRAINT ck_activity_logs_action_nonblank CHECK (btrim(action) <> ''),
        CONSTRAINT ck_activity_logs_entity_type_nonblank CHECK (btrim(entity_type) <> ''),
        CONSTRAINT ck_activity_logs_before_data_object CHECK (
          before_data IS NULL OR jsonb_typeof(before_data) = 'object'
        ),
        CONSTRAINT ck_activity_logs_after_data_object CHECK (
          after_data IS NULL OR jsonb_typeof(after_data) = 'object'
        ),
        CONSTRAINT ck_activity_logs_metadata_object CHECK (
          jsonb_typeof(metadata) = 'object'
        ),
        CONSTRAINT ck_activity_logs_outcome CHECK (
          outcome IN ('SUCCESS', 'FAILURE', 'DENIED')
        )
      );

      CREATE INDEX ix_activity_logs_entity_timeline
        ON activity_logs (entity_type, entity_id, occurred_at DESC);
      CREATE INDEX ix_activity_logs_actor_timeline
        ON activity_logs (actor_user_id, occurred_at DESC);
      CREATE INDEX ix_activity_logs_request_id ON activity_logs (request_id);
      CREATE INDEX ix_activity_logs_action_timeline
        ON activity_logs (action, occurred_at DESC);
      CREATE INDEX ix_activity_logs_occurred_at ON activity_logs (occurred_at DESC);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE activity_logs;
      DROP TABLE audit_issue_transitions;
      DROP TABLE audit_issues;
      DROP TABLE audit_observations;
      DROP TABLE audit_scan_events;
      DROP TABLE audit_campaign_assets;
      DROP TABLE audit_campaign_auditors;
      DROP TABLE audit_campaign_locations;
      DROP TABLE audit_campaign_transitions;
      DROP TABLE audit_campaigns;
      DROP TABLE asset_movements;
      DROP TABLE asset_assignments;
      DROP TABLE asset_identifiers;
      DROP TABLE asset_lifecycle_transitions;
      DROP TABLE assets;
      DROP TABLE locations;
      DROP TABLE asset_categories;
      DROP TABLE auth_refresh_tokens;
      DROP TABLE auth_sessions;
      DROP TABLE role_permissions;
      DROP TABLE user_roles;
      DROP TABLE permissions;
      DROP TABLE roles;
      DROP TABLE users;
    `);
  }
}
