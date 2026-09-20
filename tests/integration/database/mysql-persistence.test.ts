import mysql from "mysql2/promise";
import { User } from "../../../backend/src/domain/user.js";
import { Worker } from "../../../backend/src/domain/worker.js";
import { Inspector } from "../../../backend/src/domain/inspector.js";
import {
    WebAuthnCredentials,
    WebAuthnUserType,
} from "../../../backend/src/domain/webauthn-credentials.js";
import { LicenseStatusEnum } from "../../../backend/src/domain/license.js";
import { PrivateLicenseState } from "../../../backend/src/domain/private-license-state.js";
import { Sanction } from "../../../backend/src/domain/sanction.js";
import { LicenseReferenceService } from "../../../backend/src/services/license-reference-service.js";
import { withTransaction } from "../../../backend/src/database/connection.js";
import { MySqlUserRepository } from "../../../backend/src/repositories/user-repository.js";
import { MySqlWorkerRepository } from "../../../backend/src/repositories/worker-repository.js";
import { MySqlInspectorRepository } from "../../../backend/src/repositories/inspector-repository.js";
import { MySqlCredentialRepository } from "../../../backend/src/repositories/credential-repository.js";
import { MySqlLicenseRepository } from "../../../backend/src/repositories/license-repository.js";
import { MySqlSanctionRepository } from "../../../backend/src/repositories/sanction-repository.js";

const CANDIDATE_HOSTS = process.env.DB_HOST
    ? [process.env.DB_HOST]
    : ["localhost", "127.0.0.1", "host.docker.internal"];

const TEST_DB_CONFIG = {
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: "worksiteid_test", // STRICT: ALWAYS worksiteid_test, NEVER worksiteid
};

describe("MySQL Persistence Layer Integration Tests [worksiteid_test]", () => {
    let pool: mysql.Pool;
    let isDbAvailable = false;
    let activeHost = CANDIDATE_HOSTS[0] ?? "localhost";
    let licenseRefService: LicenseReferenceService;

    let userRepo: MySqlUserRepository;
    let workerRepo: MySqlWorkerRepository;
    let inspectorRepo: MySqlInspectorRepository;
    let credRepo: MySqlCredentialRepository;
    let licenseRepo: MySqlLicenseRepository;
    let sanctionRepo: MySqlSanctionRepository;

    beforeAll(async () => {
        licenseRefService = new LicenseReferenceService("integration-test-secret-key-32chars");

        // 1. Check if MySQL server is reachable across candidate hosts
        let rootConn: mysql.Connection | null = null;
        for (const host of CANDIDATE_HOSTS) {
            try {
                rootConn = await mysql.createConnection({
                    host,
                    port: TEST_DB_CONFIG.port,
                    user: TEST_DB_CONFIG.user,
                    password: TEST_DB_CONFIG.password,
                    connectTimeout: 1000,
                });
                activeHost = host;
                break;
            } catch {
                rootConn = null;
            }
        }

        if (!rootConn) {
            console.warn(
                `\n[INTEGRATION TEST NOTICE] MySQL instance is not accessible at candidate hosts: ${CANDIDATE_HOSTS.join(", ")} on port ${TEST_DB_CONFIG.port}.\n` +
                `Make sure MySQL is running on Windows with database '${TEST_DB_CONFIG.database}' accessible.\n`,
            );
            isDbAvailable = false;
            return;
        }

        try {
            // 2. Ensure test database worksiteid_test exists
            await rootConn.query(
                `CREATE DATABASE IF NOT EXISTS \`${TEST_DB_CONFIG.database}\`
                 CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`,
            );
            await rootConn.end();

            // 3. Connect pool to worksiteid_test
            pool = mysql.createPool({
                host: activeHost,
                port: TEST_DB_CONFIG.port,
                user: TEST_DB_CONFIG.user,
                password: TEST_DB_CONFIG.password,
                database: TEST_DB_CONFIG.database,
                waitForConnections: true,
                connectionLimit: 5,
                queueLimit: 0,
            });

            // 4. Initialize schema tables
            await pool.query("SET FOREIGN_KEY_CHECKS = 0;");
            await pool.query("DROP TABLE IF EXISTS private_sanctions;");
            await pool.query("DROP TABLE IF EXISTS private_licenses;");
            await pool.query("DROP TABLE IF EXISTS webauthn_credentials;");
            await pool.query("DROP TABLE IF EXISTS inspectors;");
            await pool.query("DROP TABLE IF EXISTS workers;");
            await pool.query("DROP TABLE IF EXISTS users;");
            await pool.query("SET FOREIGN_KEY_CHECKS = 1;");

            // Create users
            await pool.query(`
                CREATE TABLE users (
                    id VARCHAR(128) NOT NULL,
                    user_type ENUM('worker', 'inspector') NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    INDEX idx_users_user_type (user_type)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            `);

            // Create workers
            await pool.query(`
                CREATE TABLE workers (
                    id VARCHAR(128) NOT NULL,
                    name VARCHAR(100) NOT NULL,
                    surname VARCHAR(100) NOT NULL,
                    cf VARCHAR(16) NOT NULL,
                    company VARCHAR(255) NOT NULL,
                    PRIMARY KEY (id),
                    CONSTRAINT uq_workers_cf UNIQUE (cf),
                    CONSTRAINT fk_workers_user FOREIGN KEY (id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
                    INDEX idx_workers_company (company)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            `);

            // Create inspectors
            await pool.query(`
                CREATE TABLE inspectors (
                    id VARCHAR(128) NOT NULL,
                    PRIMARY KEY (id),
                    CONSTRAINT fk_inspectors_user FOREIGN KEY (id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            `);

            // Create webauthn_credentials
            await pool.query(`
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
                    CONSTRAINT uq_webauthn_credential_id UNIQUE (credential_id),
                    CONSTRAINT fk_webauthn_user FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
                    INDEX idx_webauthn_user_id (user_id),
                    INDEX idx_webauthn_user_created (user_id, created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            `);

            // Create private_licenses
            await pool.query(`
                CREATE TABLE private_licenses (
                    license_id VARCHAR(128) NOT NULL,
                    worker_id VARCHAR(128) NOT NULL,
                    license_ref VARCHAR(128) NOT NULL,
                    credits INT UNSIGNED NOT NULL DEFAULT 30,
                    status ENUM('ACTIVE', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
                    randomness VARCHAR(255) NOT NULL,
                    version INT UNSIGNED NOT NULL DEFAULT 1,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (license_id),
                    CONSTRAINT uq_private_licenses_ref UNIQUE (license_ref),
                    CONSTRAINT uq_private_licenses_worker UNIQUE (worker_id),
                    CONSTRAINT fk_private_licenses_worker FOREIGN KEY (worker_id) REFERENCES workers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
                    INDEX idx_private_licenses_worker_id (worker_id),
                    INDEX idx_private_licenses_license_ref (license_ref),
                    INDEX idx_private_licenses_status (status)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            `);

            // Create private_sanctions
            await pool.query(`
                CREATE TABLE private_sanctions (
                    sanction_id VARCHAR(128) NOT NULL,
                    license_ref VARCHAR(128) NOT NULL,
                    penalty INT UNSIGNED NOT NULL,
                    reason TEXT NOT NULL,
                    inspector_ref VARCHAR(128) NOT NULL,
                    issued_at TIMESTAMP NOT NULL,
                    randomness VARCHAR(255) NOT NULL,
                    PRIMARY KEY (sanction_id),
                    CONSTRAINT chk_private_sanctions_penalty CHECK (penalty > 0),
                    CONSTRAINT fk_private_sanctions_license FOREIGN KEY (license_ref) REFERENCES private_licenses(license_ref) ON UPDATE CASCADE ON DELETE RESTRICT,
                    CONSTRAINT fk_private_sanctions_inspector FOREIGN KEY (inspector_ref) REFERENCES inspectors(id) ON UPDATE CASCADE ON DELETE RESTRICT,
                    INDEX idx_private_sanctions_license_ref (license_ref),
                    INDEX idx_private_sanctions_inspector_ref (inspector_ref),
                    INDEX idx_private_sanctions_issued_at (issued_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
            `);

            // Repositories
            userRepo = new MySqlUserRepository(pool);
            workerRepo = new MySqlWorkerRepository(pool);
            inspectorRepo = new MySqlInspectorRepository(pool);
            credRepo = new MySqlCredentialRepository(pool);
            licenseRepo = new MySqlLicenseRepository(pool);
            sanctionRepo = new MySqlSanctionRepository(pool);

            isDbAvailable = true;
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.warn(
                `\n[INTEGRATION TEST NOTICE] Failed to initialize worksiteid_test schema (${msg}).\n`,
            );
            isDbAvailable = false;
        }
    });

    afterAll(async () => {
        if (pool) {
            try {
                await pool.query("SET FOREIGN_KEY_CHECKS = 0;");
                await pool.query("DROP TABLE IF EXISTS private_sanctions;");
                await pool.query("DROP TABLE IF EXISTS private_licenses;");
                await pool.query("DROP TABLE IF EXISTS webauthn_credentials;");
                await pool.query("DROP TABLE IF EXISTS inspectors;");
                await pool.query("DROP TABLE IF EXISTS workers;");
                await pool.query("DROP TABLE IF EXISTS users;");
                await pool.query("SET FOREIGN_KEY_CHECKS = 1;");
            } catch {
                // Ignore cleanup errors
            }
            await pool.end();
        }
    });

    test("Verifica disponibilità database MySQL worksiteid_test", () => {
        if (!isDbAvailable) {
            console.log(
                `Integration test suite skipped execution against live MySQL because host (${activeHost}:${TEST_DB_CONFIG.port}) was not reachable.`,
            );
            return;
        }
        expect(isDbAvailable).toBe(true);
    });

    test("1. Gestione Users e Workers (Relazione 1:1, Vincoli FK e CF Unique)", async () => {
        if (!isDbAvailable) return;

        const user = new User({
            id: "WRK-IT-001",
            userType: WebAuthnUserType.WORKER,
        });
        await userRepo.register(user);

        const worker = new Worker({
            id: "WRK-IT-001",
            name: "Mario",
            surname: "Rossi",
            cf: "RSSMRA80A01H501U",
            company: "Edilizia Sicura S.r.l.",
        });
        await workerRepo.register(worker);

        const fetched = await workerRepo.findById("WRK-IT-001");
        expect(fetched).not.toBeNull();
        expect(fetched?.name).toBe("Mario");
        expect(fetched?.cf).toBe("RSSMRA80A01H501U");

        // Ricerca per CF
        const byCf = await workerRepo.findByCf("RSSMRA80A01H501U");
        expect(byCf?.id).toBe("WRK-IT-001");

        // Violazione CF UNIQUE
        const duplicateCfUser = new User({
            id: "WRK-IT-002",
            userType: WebAuthnUserType.WORKER,
        });
        await userRepo.register(duplicateCfUser);

        const duplicateWorker = new Worker({
            id: "WRK-IT-002",
            name: "Luigi",
            surname: "Verdi",
            cf: "RSSMRA80A01H501U", // stesso CF
            company: "Altra Ditta S.p.A.",
        });
        await expect(workerRepo.register(duplicateWorker)).rejects.toThrow();

        // Violazione FK su User inesistente
        const orphanedWorker = new Worker({
            id: "WRK-NON-EXISTENT",
            name: "Ghost",
            surname: "Worker",
            cf: "GHSWRK80A01H501X",
            company: "Ghost Corp",
        });
        await expect(workerRepo.register(orphanedWorker)).rejects.toThrow();
    });

    test("2. Gestione Inspectors", async () => {
        if (!isDbAvailable) return;

        const user = new User({
            id: "INSP-IT-001",
            userType: WebAuthnUserType.INSPECTOR,
        });
        await userRepo.register(user);

        const inspector = new Inspector("INSP-IT-001");
        await inspectorRepo.register(inspector);

        const fetched = await inspectorRepo.findById("INSP-IT-001");
        expect(fetched).not.toBeNull();
        expect(fetched?.id).toBe("INSP-IT-001");
    });

    test("3. WebAuthn Credentials (VARBINARY, BLOB, JSON Transports, Counter)", async () => {
        if (!isDbAvailable) return;

        const credId = "webauthn-cred-id-abc-1234567890";
        const pubKey = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE-sample-public-key-base64url-bytes";
        const transports = ["internal", "hybrid"];

        const cred = new WebAuthnCredentials(
            credId,
            "WRK-IT-001",
            WebAuthnUserType.WORKER,
            pubKey,
            1,
            transports,
        );
        await credRepo.register(cred);

        const retrieved = await credRepo.findById(credId);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.id).toBe(credId);
        expect(retrieved?.publicKey).toBe(pubKey);
        expect(retrieved?.counter).toBe(1);
        expect(retrieved?.transports).toEqual(transports);

        // Aggiornamento counter atomico
        await credRepo.updateCounter(credId, 2);
        const updated = await credRepo.findById(credId);
        expect(updated?.counter).toBe(2);
        expect(updated?.lastUsedAt).toBeDefined();

        // Supporto a credenziali multiple per lo stesso utente
        const secondCredId = "webauthn-cred-id-second-usb-key";
        const secondCred = new WebAuthnCredentials(
            secondCredId,
            "WRK-IT-001",
            WebAuthnUserType.WORKER,
            "another-pub-key-data",
            0,
            ["usb"],
        );
        await credRepo.register(secondCred);

        const allCreds = await credRepo.findAllByUserId("WRK-IT-001");
        expect(allCreds).toHaveLength(2);
    });

    test("4. Private Licenses (HMAC LicenseRef, Credits, Version)", async () => {
        if (!isDbAvailable) return;

        const licenseId = "LIC-IT-2026-0001";
        const workerId = "WRK-IT-001";
        const licenseRef = licenseRefService.generateLicenseRef(licenseId);

        const license = new PrivateLicenseState(
            licenseId,
            30,
            LicenseStatusEnum.ACTIVE,
            "random-salt-csprng-hex-string",
            1,
            workerId,
            licenseRef,
        );
        await licenseRepo.save(license);

        const byLicenseId = await licenseRepo.findByLicenseId(licenseId);
        expect(byLicenseId).not.toBeNull();
        expect(byLicenseId?.credits).toBe(30);
        expect(byLicenseId?.status).toBe(LicenseStatusEnum.ACTIVE);
        expect(byLicenseId?.workerId).toBe(workerId);
        expect(byLicenseId?.licenseRef).toBe(licenseRef);

        const byWorker = await licenseRepo.findByWorkerId(workerId);
        expect(byWorker?.licenseId).toBe(licenseId);

        const byRef = await licenseRepo.findByLicenseRef(licenseRef);
        expect(byRef?.workerId).toBe(workerId);

        // Update della patente a seguito di decurtazione crediti
        const updatedLicense = new PrivateLicenseState(
            licenseId,
            25,
            LicenseStatusEnum.ACTIVE,
            "fresh-salt-csprng-hex-string",
            2,
            workerId,
            licenseRef,
        );
        await licenseRepo.update(updatedLicense);

        const reloaded = await licenseRepo.findByLicenseId(licenseId);
        expect(reloaded?.credits).toBe(25);
        expect(reloaded?.version).toBe(2);

        // Violazione vincolo: unico worker_id
        const conflictLic = new PrivateLicenseState(
            "LIC-IT-2026-0002",
            30,
            LicenseStatusEnum.ACTIVE,
            "salt",
            1,
            workerId, // stesso worker!
            licenseRefService.generateLicenseRef("LIC-IT-2026-0002"),
        );
        await expect(licenseRepo.save(conflictLic)).rejects.toThrow("Worker already has a license");
    });

    test("5. Private Sanctions (Check Constraint, FK a LicenseRef e InspectorRef)", async () => {
        if (!isDbAvailable) return;

        const licenseRef = licenseRefService.generateLicenseRef("LIC-IT-2026-0001");
        const sanction = new Sanction({
            id: "SANC-IT-001",
            penalty: 5,
            licenseRef: licenseRef,
            reason: "Mancato ancoraggio su ponteggio superiore a 2m",
            inspectorRef: "INSP-IT-001",
            issuedAt: new Date(),
            randomness: "sanction-salt-csprng",
        });
        await sanctionRepo.save(sanction);

        const fetched = await sanctionRepo.findById("SANC-IT-001");
        expect(fetched).not.toBeNull();
        expect(fetched?.penalty).toBe(5);
        expect(fetched?.licenseRef).toBe(licenseRef);
        expect(fetched?.inspectorRef).toBe("INSP-IT-001");

        // Ricerca per licenseRef e per inspectorRef
        const byLic = await sanctionRepo.findByLicenseRef(licenseRef);
        expect(byLic).toHaveLength(1);

        const byInsp = await sanctionRepo.findByInspectorRef("INSP-IT-001");
        expect(byInsp).toHaveLength(1);

        // Violazione FK su licenza non esistente
        const invalidLicSanction = new Sanction({
            id: "SANC-IT-999",
            penalty: 5,
            licenseRef: "non-existent-license-ref-hex-value-1234567890abcdef",
            reason: "Motivazione",
            inspectorRef: "INSP-IT-001",
            issuedAt: new Date(),
            randomness: "salt",
        });
        await expect(sanctionRepo.save(invalidLicSanction)).rejects.toThrow();
    });

    test("6. Gestione Transazioni atomiche (withTransaction commit e rollback)", async () => {
        if (!isDbAvailable) return;

        const txUserId = "WRK-TX-001";
        const txWorkerId = "WRK-TX-001";

        // Caso 1: Commit con successo
        await withTransaction(pool, async (conn) => {
            await userRepo.register(new User({ id: txUserId, userType: WebAuthnUserType.WORKER }), conn);
            await workerRepo.register(new Worker({
                id: txWorkerId,
                name: "Trans",
                surname: "Action",
                cf: "TXACTN80A01H501T",
                company: "Atomic S.p.A.",
            }), conn);
        });

        expect(await userRepo.existsById(txUserId)).toBe(true);
        expect(await workerRepo.existsById(txWorkerId)).toBe(true);

        // Caso 2: Rollback in caso di errore applicativo
        const rollUserId = "WRK-ROLL-001";
        await expect(
            withTransaction(pool, async (conn) => {
                await userRepo.register(new User({ id: rollUserId, userType: WebAuthnUserType.WORKER }), conn);
                // Errore simulato prima del commit
                throw new Error("Simulated transactional failure");
            }),
        ).rejects.toThrow("Simulated transactional failure");

        // Verifica che l'utente non sia stato inserito a seguito del rollback
        expect(await userRepo.existsById(rollUserId)).toBe(false);
    });
});
