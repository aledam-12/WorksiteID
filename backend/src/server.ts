/**
 * @file server.ts
 * @description Punto di ingresso runtime (entrypoint) del backend WorksiteID.
 * Inizializza il pool MySQL con fallback sicuro in-memory, verifica la connettività con FireFly / Fabric,
 * istanzia i servizi di sicurezza concreti e avvia il server Fastify in ascolto su porta 3000.
 *
 * @dependencies
 * - config/index.js: configurazione d'ambiente (porte, host, credenziali).
 * - database/connection.js: creazione pool MySQL e ping di verifica.
 * - repositories/*: implementazioni MySQL dei repository.
 * - security/*: istanze reali di FireFlyClient, BlockchainService e CommitmentService.
 * - app.js: factory buildApp.
 */

import { envConfig } from "./config/index.js";
import { buildApp, type AppDependencies } from "./app.js";
import { createDatabasePool, pingDatabase } from "./database/connection.js";
import { MySqlUserRepository } from "./repositories/user-repository.js";
import { MySqlWorkerRepository } from "./repositories/worker-repository.js";
import { MySqlInspectorRepository } from "./repositories/inspector-repository.js";
import { MySqlWebAuthnCredentialRepository } from "./repositories/webauthn-credential-repository.js";
import { MySqlLicenseRepository } from "./repositories/license-repository.js";
import { MySqlSanctionRepository } from "./repositories/sanction-repository.js";
import { FireFlyClientImpl, BlockchainServiceImpl } from "./security/blockchain/index.js";
import { CommitmentServiceImpl } from "./security/zkp/index.js";

/**
 * Avvia il server backend eseguendo i probe di connettività e collegando l'infrastruttura di persistenza.
 */
async function startServer() {
    let deps: AppDependencies = {};

    try {
        const pool = createDatabasePool();
        const connected = await pingDatabase(pool);
        if (connected) {
            const conn = await pool.getConnection();
            let tablesExist = false;
            try {
                const [rows] = await conn.query("SHOW TABLES LIKE 'users';");
                tablesExist = Array.isArray(rows) && rows.length > 0;
            } finally {
                conn.release();
            }

            if (tablesExist) {
                console.log(
                    `[Database] Connected to MySQL (${envConfig.dbHost}:${envConfig.dbPort}/${envConfig.dbName}). Persistence mode: MySQL.`,
                );
                deps = {
                    userRepository: new MySqlUserRepository(pool),
                    workerRepository: new MySqlWorkerRepository(pool),
                    inspectorRepository: new MySqlInspectorRepository(pool),
                    credentialRepository: new MySqlWebAuthnCredentialRepository(pool),
                    licenseRepository: new MySqlLicenseRepository(pool),
                    sanctionRepository: new MySqlSanctionRepository(pool),
                };
            } else {
                console.warn(
                    `[Database] MySQL connected, but schema not found in '${envConfig.dbName}'. Import 'scripts/worksiteid_db.sql'. Falling back to InMemory.`,
                );
            }
        } else {
            console.warn(
                `[Database] MySQL not reachable at ${envConfig.dbHost}:${envConfig.dbPort}. Persistence mode: InMemory.`,
            );
        }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[Database] MySQL connection check failed (${message}). Falling back to InMemory.`);
    }

    // 2. Setup Blockchain (FireFly / Hyperledger Fabric) & Poseidon Commitment Service
    const fireflyClient = new FireFlyClientImpl();
    const blockchainService = new BlockchainServiceImpl(fireflyClient);
    const commitmentService = new CommitmentServiceImpl();

    try {
        const resp = await fetch(`${envConfig.fireflyUrl}/api/v1/status`, {
            signal: AbortSignal.timeout(1500),
        });
        if (resp.ok) {
            console.log(
                `[Blockchain] Connected to FireFly at ${envConfig.fireflyUrl} (namespace: ${envConfig.fireflyNamespace}, api: ${envConfig.fireflyApiName}). Ledger: Hyperledger Fabric.`,
            );
        } else {
            console.warn(
                `[Blockchain] WARNING: FireFly returned status ${resp.status}. Ensure 'ff start worksiteid' is running and healthy.`,
            );
        }
    } catch {
        console.warn(
            `[Blockchain] WARNING: FireFly at ${envConfig.fireflyUrl} is not reachable. Ensure 'ff start worksiteid' is active.`,
        );
    }

    deps.blockchainService = blockchainService;
    deps.commitmentService = commitmentService;

    const app = buildApp(deps);

    await app.listen({
        port: envConfig.port,
        host: "0.0.0.0",
    });

    console.log(`WorksiteID backend listening on port ${envConfig.port}`);
}

startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});