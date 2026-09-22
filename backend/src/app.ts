/**
 * @file app.ts
 * @description Factory principale dell'applicazione backend Fastify.
 * Assembla il container di dependency injection (repositories e moduli di sicurezza),
 * configura middleware globali (parser JSON, CORS) e registra le rotte REST modulari.
 *
 * @dependencies
 * - fastify: framework web Node.js ad alte prestazioni.
 * - repositories/*: layer di persistenza dati per utenti, credenziali, patenti e sanzioni.
 * - security/*: moduli di sicurezza specializzati (Blockchain, ZKP, VC, WebAuthn).
 * - routes/index.js: router centralizzato.
 */

import fastify, { type FastifyInstance } from "fastify";
import { type UserRepository, InMemoryUserRepository } from "./repositories/user-repository.js";
import { type WorkerRepository, InMemoryWorkerRepository } from "./repositories/worker-repository.js";
import { type InspectorRepository, InMemoryInspectorRepository } from "./repositories/inspector-repository.js";
import { type WebAuthnCredentialRepository, InMemoryWebAuthnCredentialRepository } from "./repositories/webauthn-credential-repository.js";
import { type LicenseRepository, InMemoryLicenseRepository } from "./repositories/license-repository.js";
import { type SanctionRepository, InMemorySanctionRepository } from "./repositories/sanction-repository.js";
import { User } from "./domain/user.js";
import { Worker } from "./domain/worker.js";
import { Inspector } from "./domain/inspector.js";
import { LicenseStatusEnum } from "./domain/license.js";
import { PrivateLicenseState } from "./domain/private-license-state.js";
import { Sanction } from "./domain/sanction.js";
import { WebAuthnUserType } from "./domain/webauthn-credentials.js";
import { envConfig } from "./config/index.js";

// Moduli di Sicurezza
import { type BlockchainService } from "./security/blockchain/blockchain.service.js";
import { type CommitmentService, CommitmentServiceImpl } from "./security/zkp/commitment.service.js";
import { type ChallengeService, ChallengeServiceImpl } from "./security/zkp/challenge.service.js";
import { LicenseReferenceService } from "./security/zkp/license-reference.service.js";
import { type LicenseVerificationService } from "./security/zkp/license-verification.service.js";
import { type CredentialIssuerService, CredentialIssuerServiceImpl } from "./security/vc/vc-issuer.service.js";
import { type CredentialVerifierService, CredentialVerifierServiceImpl } from "./security/vc/vc-verifier.service.js";
import { type WebAuthnService, WebAuthnServiceImpl } from "./security/webauthn/webauthn.service.js";
import { SessionManager, type SessionData } from "./security/webauthn/session-manager.js";

// Router centralizzato
import { registerAllRoutes } from "./routes/index.js";

export type { SessionData };

/**
 * Dipendenze opzionali iniettabili nella factory buildApp (utili per unit test o esecuzione custom).
 */
export interface AppDependencies {
    userRepository?: UserRepository;
    workerRepository?: WorkerRepository;
    inspectorRepository?: InspectorRepository;
    credentialRepository?: WebAuthnCredentialRepository;
    licenseRepository?: LicenseRepository;
    sanctionRepository?: SanctionRepository;
    credentialIssuerService?: CredentialIssuerService;
    credentialVerifierService?: CredentialVerifierService;
    licenseReferenceService?: LicenseReferenceService;
    licenseVerificationService?: LicenseVerificationService;
    challengeService?: ChallengeService;
    webAuthnService?: WebAuthnService;
    blockchainService?: BlockchainService;
    commitmentService?: CommitmentService;
    sessionManager?: SessionManager;
}

/**
 * Costruisce e configura un'istanza Fastify pronta all'ascolto o al testing.
 * @param deps Dipendenze applicative opzionali (in-memory di default)
 * @returns Istanza configurata di Fastify
 */
export function buildApp(deps: AppDependencies = {}): FastifyInstance {
    const app = fastify();

    // 1. Parsing JSON sicuro
    app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, body: string, done) => {
        if (!body || body.trim() === "") {
            done(null, {});
            return;
        }
        try {
            done(null, JSON.parse(body));
        } catch (err) {
            done(err as Error, undefined);
        }
    });

    // 2. CORS Hook per Next.js frontend
    app.addHook("onRequest", async (request, reply) => {
        reply.header("Access-Control-Allow-Origin", "*");
        reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        if (request.method === "OPTIONS") {
            return reply.status(204).send();
        }
    });

    // 3. Risoluzione dei Repositories (InMemory di default per unit test isolati)
    const userRepo = deps.userRepository ?? new InMemoryUserRepository();
    const workerRepo = deps.workerRepository ?? new InMemoryWorkerRepository();
    const inspectorRepo = deps.inspectorRepository ?? new InMemoryInspectorRepository();
    const credRepo = deps.credentialRepository ?? new InMemoryWebAuthnCredentialRepository();
    const licenseRepo = deps.licenseRepository ?? new InMemoryLicenseRepository();
    const sanctionRepo = deps.sanctionRepository ?? new InMemorySanctionRepository();

    // 4. Inizializzazione dei Servizi dei 4 Moduli di Sicurezza
    const licenseRefSecret = envConfig.licenseRefSecret || "worksiteid-dev-license-ref-secret";
    const licenseRefService = deps.licenseReferenceService ?? new LicenseReferenceService(licenseRefSecret);
    const commitmentService = deps.commitmentService ?? new CommitmentServiceImpl();
    const blockchainService = deps.blockchainService;

    const challengeService = deps.challengeService ?? new ChallengeServiceImpl();
    const verificationService = deps.licenseVerificationService;

    const issuerService = deps.credentialIssuerService ?? new CredentialIssuerServiceImpl(workerRepo, {}, licenseRepo);
    const verifierService = deps.credentialVerifierService ?? new CredentialVerifierServiceImpl({
        expectedIssuer: issuerService.getIssuerId(),
        publicKeyPem: issuerService.getPublicKeyPem(),
    });

    const webAuthnService = deps.webAuthnService ?? new WebAuthnServiceImpl();
    const sessionManager = deps.sessionManager ?? new SessionManager();

    // 5. Registrazione modulare di tutte le rotte disaccoppiate
    registerAllRoutes(app, {
        userRepo,
        workerRepo,
        inspectorRepo,
        credRepo,
        licenseRepo,
        sanctionRepo,
        licenseRefService,
        commitmentService,
        blockchainService,
        webAuthnService,
        sessionManager,
        issuerService,
        verifierService,
        challengeService,
        verificationService,
    });

    // 6. Popolamento dati demo per test in-memory
    const isInMemory = userRepo instanceof InMemoryUserRepository;
    const shouldSeed = isInMemory || process.env.SEED_DEMO_DATA === "true";
    if (shouldSeed) {
        void seedInitialDemoData({
            userRepo,
            workerRepo,
            inspectorRepo,
            licenseRepo,
            sanctionRepo,
            licenseRefService,
        });
    }

    return app;
}

async function seedInitialDemoData(ctx: {
    userRepo: UserRepository;
    workerRepo: WorkerRepository;
    inspectorRepo: InspectorRepository;
    licenseRepo: LicenseRepository;
    sanctionRepo: SanctionRepository;
    licenseRefService: LicenseReferenceService;
}): Promise<void> {
    const { userRepo, workerRepo, inspectorRepo, licenseRepo, sanctionRepo, licenseRefService } = ctx;
    const workerId = "WRK-001";
    const inspectorId = "INSP-001";
    const licenseId = "LIC-001";
    const licenseRef = licenseRefService.generateLicenseRef(licenseId);

    const existingCf = workerRepo.findByCf ? await workerRepo.findByCf("RSSMRA80A01H501U") : null;
    if (!(await userRepo.existsById(workerId)) && !existingCf) {
        await userRepo.register(new User({ id: workerId, userType: WebAuthnUserType.WORKER }));
        await workerRepo.register(new Worker({
            id: workerId,
            name: "Alessandro",
            surname: "Rossi",
            cf: "RSSMRA80A01H501U",
            company: "Edilizia Sicura S.r.l.",
            licenseId,
        }));
    }

    if (!(await userRepo.existsById(inspectorId))) {
        await userRepo.register(new User({ id: inspectorId, userType: WebAuthnUserType.INSPECTOR }));
        await inspectorRepo.register(new Inspector(inspectorId));
    }

    if (!(await licenseRepo.findByWorkerId(workerId))) {
        await licenseRepo.save(new PrivateLicenseState(
            licenseId,
            30,
            LicenseStatusEnum.ACTIVE,
            "csprng-salt-worker-001-demo",
            1,
            workerId,
            licenseRef,
        ));
    }

    const existingSanctions = await sanctionRepo.findByLicenseRef(licenseRef);
    if (existingSanctions.length === 0) {
        await sanctionRepo.save(new Sanction({
            id: "SANC-001",
            licenseRef,
            penalty: 5,
            reason: "Mancato ancoraggio della linea vita durante i lavori su ponteggio",
            inspectorRef: inspectorId,
            issuedAt: new Date(Date.now() - 86400000),
            randomness: "csprng-salt-sanction-001",
        }));
    }
}
