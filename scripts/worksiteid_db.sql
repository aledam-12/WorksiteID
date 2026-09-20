-- ============================================================
-- WorksiteID - MySQL schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS worksiteid
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_0900_ai_ci;

USE worksiteid;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS private_sanctions;
DROP TABLE IF EXISTS private_licenses;
DROP TABLE IF EXISTS webauthn_credentials;
DROP TABLE IF EXISTS inspectors;
DROP TABLE IF EXISTS workers;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================
-- USERS
-- Common authentication identity for Worker and Inspector.
-- No passwords, private keys, Fabric identities or credentials
-- are stored here.
-- ============================================================

CREATE TABLE users (
    id VARCHAR(128) NOT NULL,
    user_type ENUM('worker', 'inspector') NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    INDEX idx_users_user_type (user_type)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================
-- WORKERS
-- Business/domain data of the worker.
-- License relationship is stored exclusively in
-- private_licenses.worker_id.
-- ============================================================

CREATE TABLE workers (
    id VARCHAR(128) NOT NULL,
    name VARCHAR(100) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    cf VARCHAR(16) NOT NULL,
    company VARCHAR(255) NOT NULL,

    PRIMARY KEY (id),

    CONSTRAINT uq_workers_cf
        UNIQUE (cf),

    CONSTRAINT fk_workers_user
        FOREIGN KEY (id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    INDEX idx_workers_company (company)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================
-- INSPECTORS
-- ============================================================

CREATE TABLE inspectors (
    id VARCHAR(128) NOT NULL,

    PRIMARY KEY (id),

    CONSTRAINT fk_inspectors_user
        FOREIGN KEY (id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================
-- WEBAUTHN CREDENTIALS
--
-- credential_id = raw WebAuthn credential identifier
-- public_key   = COSE public key bytes
-- counter      = authenticator signature counter
-- transports   = WebAuthn transports
-- ============================================================

CREATE TABLE webauthn_credentials (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id VARCHAR(128) NOT NULL,

    credential_id VARBINARY(1024) NOT NULL,
    public_key BLOB NOT NULL,

    counter BIGINT UNSIGNED NOT NULL DEFAULT 0,

    transports JSON NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP NULL DEFAULT NULL,

    PRIMARY KEY (id),

    CONSTRAINT uq_webauthn_credential_id
        UNIQUE (credential_id),

    CONSTRAINT fk_webauthn_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    INDEX idx_webauthn_user_id (user_id),
    INDEX idx_webauthn_user_created (user_id, created_at)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================
-- PRIVATE LICENSES
--
-- Private state only.
--
-- license_ref is a pseudonymous deterministic reference
-- generated from license_id through the application-level
-- HMAC secret. It is the value used to correlate the private
-- state with the public blockchain state.
--
-- The worker -> license relationship is represented ONLY here.
-- ============================================================

CREATE TABLE private_licenses (
    license_id VARCHAR(128) NOT NULL,
    worker_id VARCHAR(128) NOT NULL,

    license_ref VARCHAR(128) NOT NULL,

    credits INT UNSIGNED NOT NULL DEFAULT 30,
    status ENUM('ACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',

    randomness VARCHAR(255) NOT NULL,

    version INT UNSIGNED NOT NULL DEFAULT 1,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (license_id),

    CONSTRAINT uq_private_licenses_ref
        UNIQUE (license_ref),

    CONSTRAINT uq_private_licenses_worker
        UNIQUE (worker_id),

    CONSTRAINT fk_private_licenses_worker
        FOREIGN KEY (worker_id)
        REFERENCES workers(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    INDEX idx_private_licenses_worker_id (worker_id),
    INDEX idx_private_licenses_license_ref (license_ref),
    INDEX idx_private_licenses_status (status)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;


-- ============================================================
-- PRIVATE SANCTIONS
--
-- license_ref is used instead of the raw license_id.
-- inspector_ref references the internal Inspector identity.
--
-- Sanction details remain completely off-chain.
-- ============================================================

CREATE TABLE private_sanctions (
    sanction_id VARCHAR(128) NOT NULL,

    license_ref VARCHAR(128) NOT NULL,

    penalty INT UNSIGNED NOT NULL,
    reason TEXT NOT NULL,

    inspector_ref VARCHAR(128) NOT NULL,

    issued_at TIMESTAMP NOT NULL,

    randomness VARCHAR(255) NOT NULL,

    PRIMARY KEY (sanction_id),

    CONSTRAINT chk_private_sanctions_penalty
        CHECK (penalty > 0),

    CONSTRAINT fk_private_sanctions_license
        FOREIGN KEY (license_ref)
        REFERENCES private_licenses(license_ref)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT fk_private_sanctions_inspector
        FOREIGN KEY (inspector_ref)
        REFERENCES inspectors(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    INDEX idx_private_sanctions_license_ref (license_ref),
    INDEX idx_private_sanctions_inspector_ref (inspector_ref),
    INDEX idx_private_sanctions_issued_at (issued_at)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci;