import crypto from "node:crypto";
import fastify, { FastifyInstance, FastifyRequest } from "fastify";
import { InMemoryUserRepository, UserRepository } from "./repositories/user-repository.js";
import { InMemoryWorkerRepository, WorkerRepository } from "./repositories/worker-repository.js";
import { InMemoryInspectorRepository, InspectorRepository } from "./repositories/inspector-repository.js";
import { InMemoryCredentialRepository, CredentialRepository } from "./repositories/credential-repository.js";
import { InMemoryLicenseRepository, LicenseRepository } from "./repositories/license-repository.js";
import { InMemorySanctionRepository, SanctionRepository } from "./repositories/sanction-repository.js";
import { InMemoryChallengeStore } from "./repositories/challenge-store.js";
import { User } from "./domain/user.js";
import { Worker } from "./domain/worker.js";
import { Inspector } from "./domain/inspector.js";
import { LicenseStatusEnum } from "./domain/license.js";
import { PrivateLicenseState } from "./domain/private-license-state.js";
import { Sanction } from "./domain/sanction.js";
import {
    generateRegistrationOptions,
    generateAuthenticationOptions,
    verifyRegistrationResponse,
    verifyAuthenticationResponse,
    type RegistrationResponseJSON,
    type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL, isoUint8Array } from "@simplewebauthn/server/helpers";
import { WebAuthnCredentials, WebAuthnUserType } from "./domain/webauthn-credentials.js";
import { LicenseReferenceService } from "./services/license-reference-service.js";
import { CredentialIssuerServiceImpl, CredentialIssuerService } from "./services/credential-issuer-service.js";
import { CredentialVerifierServiceImpl, CredentialVerifierService } from "./services/credential-verifier-service.js";
import { ChallengeServiceImpl, ChallengeService } from "./services/challenge-service.js";
import { LicenseVerificationService } from "./services/license-verification-service.js";
import { LicenseVerificationPayload } from "./domain/zkp.js";
import { WorksiteLicenseCredential } from "./domain/verifiable-credential.js";
import { WebAuthnServiceImpl, WebAuthnService } from "./services/webauthn-service.js";
import { IdentityServiceImpl, IdentityService } from "./services/identity-service.js";
import { BlockchainService } from "./services/blockchain-service.js";
import { CommitmentServiceImpl, CommitmentService } from "./services/commitment-service.js";
import { envConfig } from "./config/index.js";

export interface AppDependencies {
    userRepository?: UserRepository;
    workerRepository?: WorkerRepository;
    inspectorRepository?: InspectorRepository;
    credentialRepository?: CredentialRepository;
    licenseRepository?: LicenseRepository;
    sanctionRepository?: SanctionRepository;
    credentialIssuerService?: CredentialIssuerService;
    credentialVerifierService?: CredentialVerifierService;
    licenseReferenceService?: LicenseReferenceService;
    licenseVerificationService?: LicenseVerificationService;
    challengeService?: ChallengeService;
    webAuthnService?: WebAuthnService;
    identityService?: IdentityService;
    blockchainService?: BlockchainService;
    commitmentService?: CommitmentService;
}

export interface SessionData {
    userId: string;
    userType: "worker" | "inspector";
    name: string;
    surname: string;
    company?: string | undefined;
    cf?: string | undefined;
}

export function buildApp(deps: AppDependencies = {}): FastifyInstance {
    const app = fastify();

    // Safely accept empty bodies even if Content-Type: application/json is passed
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

    // 1. Setup CORS Hook (allows Next.js frontend to communicate without CORS issues)
    app.addHook("onRequest", async (request, reply) => {
        reply.header("Access-Control-Allow-Origin", "*");
        reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        reply.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
        if (request.method === "OPTIONS") {
            return reply.status(204).send();
        }
    });

    // 2. Health check
    app.get("/health", async () => {
        let blockchainStatus = "UNKNOWN";
        try {
            const resp = await fetch(`${envConfig.fireflyUrl}/api/v1/status`, { signal: AbortSignal.timeout(1000) });
            blockchainStatus = resp.ok ? "UP" : "DOWN";
        } catch {
            blockchainStatus = "DOWN";
        }
        return {
            status: "ok",
            database: "UP",
            blockchain: blockchainStatus,
            fireflyUrl: envConfig.fireflyUrl,
        };
    });

    // 3. Initialize Repositories (defaults to InMemory with seed data for demo)
    const userRepo = deps.userRepository ?? new InMemoryUserRepository();
    const workerRepo = deps.workerRepository ?? new InMemoryWorkerRepository();
    const inspectorRepo = deps.inspectorRepository ?? new InMemoryInspectorRepository();
    const credRepo = deps.credentialRepository ?? new InMemoryCredentialRepository();
    const licenseRepo = deps.licenseRepository ?? new InMemoryLicenseRepository();
    const sanctionRepo = deps.sanctionRepository ?? new InMemorySanctionRepository();

    const licenseRefSecret = envConfig.licenseRefSecret || "worksiteid-dev-license-ref-secret";
    const licenseRefService = deps.licenseReferenceService ?? new LicenseReferenceService(licenseRefSecret);

    const identityService = deps.identityService ?? new IdentityServiceImpl(workerRepo, inspectorRepo);
    const challengeStore = new InMemoryChallengeStore();
    void (deps.webAuthnService ?? new WebAuthnServiceImpl(credRepo, identityService, challengeStore));

    const issuerService = deps.credentialIssuerService ?? new CredentialIssuerServiceImpl(workerRepo, {}, licenseRepo);
    const verifierService = deps.credentialVerifierService ?? new CredentialVerifierServiceImpl({
        expectedIssuer: issuerService.getIssuerId(),
        publicKeyPem: issuerService.getPublicKeyPem(),
    });

    const challengeService = deps.challengeService ?? new ChallengeServiceImpl();
    const verificationService = deps.licenseVerificationService;
    const commitmentService = deps.commitmentService ?? new CommitmentServiceImpl();
    const blockchainService = deps.blockchainService;

    // 4. Pre-populate initial demo seed data if repositories are in-memory
    const seedInitialDemoData = async () => {
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
                issuedAt: new Date(Date.now() - 86400000), // ieri
                randomness: "csprng-salt-sanction-001",
            }));
        }
    };

    // Non-blocking seed invocation: only for in-memory or when explicitly requested via SEED_DEMO_DATA=true
    const isInMemory = userRepo instanceof InMemoryUserRepository;
    const shouldSeed = isInMemory || process.env.SEED_DEMO_DATA === "true";
    if (shouldSeed) {
        void seedInitialDemoData();
    }

    // 5. In-Memory Session & Challenge Management
    const sessions = new Map<string, SessionData>();

    interface PendingRegistration {
        id: string;
        workerId: string;
        name: string;
        surname: string;
        cf: string;
        company: string;
        userType?: "worker" | "inspector";
        challenge: string;
        createdAt: number;
    }
    const pendingRegistrations = new Map<string, PendingRegistration>();

    interface AuthChallengeData {
        challenge: string;
        createdAt: number;
    }
    const authChallenges = new Map<string, AuthChallengeData>();

    const rpID = process.env.RP_ID ?? "localhost";
    const origin = process.env.ORIGIN ?? "http://localhost:3000";
    const allowedOrigins = Array.from(new Set([
        origin,
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
    ]));

    const getSession = (request: FastifyRequest): SessionData | null => {
        const authHeader = request.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        const token = authHeader.substring("Bearer ".length).trim();
        return sessions.get(token) ?? null;
    };

    // ============================================================
    // AUTH ROUTES (/api/auth)
    // ============================================================

    // 1. Registration Phase 1: validate input, prepare WebAuthn options, store in pending
    // CRITICAL: Does NOT create an active User, Worker, Inspector, or License in repositories
    app.post("/api/auth/register", async (request, reply) => {
        const body = request.body as {
            name?: string;
            surname?: string;
            cf?: string;
            company?: string;
            userType?: string;
        } | undefined;

        const rawUserType = body?.userType?.trim().toLowerCase() || "worker";
        if (rawUserType !== "worker" && rawUserType !== "inspector") {
            return reply.status(400).send({ message: "Invalid userType: must be 'worker' or 'inspector'" });
        }
        const userType: "worker" | "inspector" = rawUserType;

        const name = body?.name?.trim();
        const surname = body?.surname?.trim();
        const cf = body?.cf?.trim().toUpperCase();
        const company = body?.company?.trim();

        if (userType === "worker") {
            if (!name || !surname || !cf || !company) {
                return reply.status(400).send({ message: "All fields (name, surname, cf, company) are required for worker registration" });
            }
        } else {
            if (!name || !surname || !cf) {
                return reply.status(400).send({ message: "Fields name, surname and cf are required for inspector registration" });
            }
        }

        if (cf.length !== 16) {
            return reply.status(400).send({ message: "Codice Fiscale must be exactly 16 characters" });
        }

        if (userType === "worker" && workerRepo.findByCf) {
            const existingWorker = await workerRepo.findByCf(cf);
            if (existingWorker) {
                return reply.status(409).send({ message: "Worker with this Codice Fiscale already exists" });
            }
        }

        const assignedId = userType === "inspector"
            ? `INSP-${crypto.randomUUID().substring(0, 8).toUpperCase()}`
            : `WRK-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
        const pendingRegistrationId = crypto.randomUUID();

        const options = await generateRegistrationOptions({
            rpName: "WorksiteID",
            rpID,
            userName: `${name} ${surname} (${cf})`,
            userID: isoUint8Array.fromUTF8String(assignedId),
            attestationType: "none",
            authenticatorSelection: {
                userVerification: "required",
                residentKey: "required",
            },
        });

        // Store ONLY in temporary pending cache (5-minute TTL).
        // No active account or license is committed to persistent stores yet!
        pendingRegistrations.set(pendingRegistrationId, {
            id: pendingRegistrationId,
            workerId: assignedId,
            name,
            surname,
            cf,
            company: company || (userType === "inspector" ? "Ispettorato di Vigilanza" : "Cantiere"),
            userType,
            challenge: options.challenge,
            createdAt: Date.now(),
        });

        return {
            pendingRegistrationId,
            options,
        };
    });

    // 2. Registration Phase 2: verify WebAuthn credential and atomically commit account
    // If verification fails or is cancelled, no active account is created
    app.post("/api/auth/register/complete", async (request, reply) => {
        const body = request.body as {
            pendingRegistrationId?: string;
            response?: RegistrationResponseJSON;
        } | undefined;

        const pendingId = body?.pendingRegistrationId?.trim();
        const regResponse = body?.response;

        if (!pendingId || !regResponse) {
            return reply.status(400).send({ message: "pendingRegistrationId and response are required" });
        }

        const pending = pendingRegistrations.get(pendingId);
        if (!pending || Date.now() - pending.createdAt > 300000) {
            pendingRegistrations.delete(pendingId);
            return reply.status(400).send({ message: "Registration session expired or not found. Please start registration again." });
        }

        try {
            const verification = await verifyRegistrationResponse({
                response: regResponse,
                expectedChallenge: pending.challenge,
                expectedOrigin: allowedOrigins,
                expectedRPID: rpID,
            });

            if (!verification.verified || !verification.registrationInfo) {
                pendingRegistrations.delete(pendingId);
                return reply.status(400).send({ message: "WebAuthn registration verification failed" });
            }

            const { credential } = verification.registrationInfo;
            const isInspector = pending.userType === "inspector";

            if (isInspector) {
                await userRepo.register(new User({
                    id: pending.workerId,
                    userType: WebAuthnUserType.INSPECTOR,
                }));

                await inspectorRepo.register(new Inspector(pending.workerId));

                const webAuthnCredential = new WebAuthnCredentials(
                    credential.id,
                    pending.workerId,
                    WebAuthnUserType.INSPECTOR,
                    isoBase64URL.fromBuffer(credential.publicKey),
                    credential.counter,
                    regResponse.response.transports as string[] | undefined,
                );
                await credRepo.register(webAuthnCredential);
            } else {
                // Atomically create User, Worker, PrivateLicenseState, and WebAuthnCredential
                const licenseId = `LIC-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
                const licenseRef = licenseRefService.generateLicenseRef(licenseId);
                const randomness = commitmentService.generateRandomness();

                // 1. Registrazione obbligatoria dello stato pubblico iniziale su Blockchain (Hyperledger Fabric via FireFly)
                if (blockchainService) {
                    try {
                        const initialCommitment = await commitmentService.createCommitment({
                            credits: 30,
                            status: LicenseStatusEnum.ACTIVE,
                            version: 1,
                        }, randomness);
                        await blockchainService.createLicense(licenseRef, initialCommitment);
                    } catch (err: unknown) {
                        const message = err instanceof Error ? err.message : String(err);
                        return reply.status(502).send({
                            message: `Errore Blockchain / FireFly: impossibile registrare la patente sul ledger immutabile (${message}). Verifica che FireFly e la blockchain siano attivi.`,
                        });
                    }
                }

                // 2. Persistenza locale nel database
                await userRepo.register(new User({
                    id: pending.workerId,
                    userType: WebAuthnUserType.WORKER,
                }));

                await workerRepo.register(new Worker({
                    id: pending.workerId,
                    name: pending.name,
                    surname: pending.surname,
                    cf: pending.cf,
                    company: pending.company,
                    licenseId,
                }));

                await licenseRepo.save(new PrivateLicenseState(
                    licenseId,
                    30,
                    LicenseStatusEnum.ACTIVE,
                    randomness,
                    1,
                    pending.workerId,
                    licenseRef,
                ));

                const webAuthnCredential = new WebAuthnCredentials(
                    credential.id,
                    pending.workerId,
                    WebAuthnUserType.WORKER,
                    isoBase64URL.fromBuffer(credential.publicKey),
                    credential.counter,
                    regResponse.response.transports as string[] | undefined,
                );
                await credRepo.register(webAuthnCredential);
            }

            // Immediately create an authenticated session so the user can navigate straight to their dashboard
            const sessionId = crypto.randomUUID();
            const userProfile: SessionData = {
                userId: pending.workerId,
                userType: isInspector ? "inspector" : "worker",
                name: pending.name,
                surname: pending.surname,
                company: isInspector ? "Ispettorato di Vigilanza" : pending.company,
                cf: pending.cf,
            };
            sessions.set(sessionId, userProfile);

            // Clean up temporary pending record
            pendingRegistrations.delete(pendingId);

            return {
                success: true,
                userId: pending.workerId,
                userType: userProfile.userType,
                sessionId,
                user: {
                    id: pending.workerId,
                    ...userProfile,
                },
            };
        } catch (err: unknown) {
            pendingRegistrations.delete(pendingId);
            const message = err instanceof Error ? err.message : "Registration failed";
            return reply.status(400).send({ message });
        }
    });

    // 3. WebAuthn Authentication Options
    // Generates discoverable authentication options without trusting client-supplied userId/userType
    app.post("/api/auth/webauthn/options", async () => {
        const authSessionId = crypto.randomUUID();
        const options = await generateAuthenticationOptions({
            rpID,
            userVerification: "required",
        });

        authChallenges.set(authSessionId, {
            challenge: options.challenge,
            createdAt: Date.now(),
        });

        return {
            options,
            authSessionId,
        };
    });

    // 4. WebAuthn Authentication Verification
    // CRITICAL: NEVER trusts userId/userType from client.
    // Identity is derived strictly from the credential ID looked up in the database!
    app.post("/api/auth/webauthn/verify", async (request, reply) => {
        const body = request.body as {
            authSessionId?: string;
            response?: AuthenticationResponseJSON;
            // client-supplied fields like userId/userType are strictly ignored for security
        } | undefined;

        const authSessionId = body?.authSessionId?.trim();
        const authResponse = body?.response;

        if (!authSessionId || !authResponse || !authResponse.id) {
            return reply.status(400).send({ message: "authSessionId and credential response are required" });
        }

        const storedChallenge = authChallenges.get(authSessionId);
        if (!storedChallenge || Date.now() - storedChallenge.createdAt > 300000) {
            authChallenges.delete(authSessionId);
            return reply.status(400).send({ message: "Authentication challenge expired or invalid" });
        }

        // LOOK UP CREDENTIAL STRICTLY BY ID FROM DB - AUTHENTICATED IDENTITY IS BOUND TO THIS RECORD
        const cred = await credRepo.findById(authResponse.id);
        if (!cred) {
            authChallenges.delete(authSessionId);
            return reply.status(401).send({ message: "Passkey credential not recognized by WorksiteID" });
        }

        try {
            const verification = await verifyAuthenticationResponse({
                response: authResponse,
                expectedChallenge: storedChallenge.challenge,
                expectedOrigin: allowedOrigins,
                expectedRPID: rpID,
                credential: {
                    id: cred.id,
                    publicKey: isoBase64URL.toBuffer(cred.publicKey),
                    counter: cred.counter,
                },
            });

            if (!verification.verified || !verification.authenticationInfo) {
                authChallenges.delete(authSessionId);
                return reply.status(401).send({ message: "WebAuthn authentication verification failed" });
            }

            // Update counter
            if (credRepo.updateCounter && verification.authenticationInfo.newCounter > cred.counter) {
                await credRepo.updateCounter(cred.id, verification.authenticationInfo.newCounter);
            } else if (verification.authenticationInfo.newCounter > cred.counter) {
                cred.updateCounter(verification.authenticationInfo.newCounter);
            }

            authChallenges.delete(authSessionId);

            // Fetch profile authoritatively from database
            let name = "Utente";
            let surname = "WorksiteID";
            let company = "Cantiere";
            let cf: string | undefined = undefined;

            if (cred.userType === WebAuthnUserType.WORKER) {
                const worker = await workerRepo.findById(cred.userId);
                if (worker) {
                    name = worker.name;
                    surname = worker.surname;
                    company = worker.company;
                    cf = worker.cf;
                }
            } else {
                const inspector = await inspectorRepo.findById(cred.userId);
                name = "Ispettore";
                surname = inspector?.id ?? cred.userId;
                company = "Ispettorato Nazionale del Lavoro";
            }

            const sessionId = crypto.randomUUID();
            const userProfile: SessionData = {
                userId: cred.userId,
                userType: cred.userType === WebAuthnUserType.INSPECTOR ? "inspector" : "worker",
                name,
                surname,
                company,
                cf,
            };
            sessions.set(sessionId, userProfile);

            return {
                user: {
                    id: userProfile.userId,
                    ...userProfile,
                },
                sessionId,
            };
        } catch (err: unknown) {
            authChallenges.delete(authSessionId);
            const message = err instanceof Error ? err.message : "Authentication failed";
            return reply.status(401).send({ message });
        }
    });

    // 5. Multi-device: Add a new Passkey to an already authenticated account
    app.post("/api/auth/webauthn/credentials/add-options", async (request, reply) => {
        const session = getSession(request);
        if (!session) {
            return reply.status(401).send({ message: "Authentication required to add a new passkey" });
        }

        const addSessionId = crypto.randomUUID();
        const existingCreds = await credRepo.findByUserId(session.userId);

        const options = await generateRegistrationOptions({
            rpName: "WorksiteID",
            rpID,
            userName: `${session.name} ${session.surname}`,
            userID: isoUint8Array.fromUTF8String(session.userId),
            attestationType: "none",
            excludeCredentials: existingCreds.map((c) => ({
                id: c.id,
            })),
            authenticatorSelection: {
                userVerification: "required",
                residentKey: "required",
            },
        });

        authChallenges.set(addSessionId, {
            challenge: options.challenge,
            createdAt: Date.now(),
        });

        return {
            options,
            addSessionId,
        };
    });

    app.post("/api/auth/webauthn/credentials/add-complete", async (request, reply) => {
        const session = getSession(request);
        if (!session) {
            return reply.status(401).send({ message: "Authentication required to add a new passkey" });
        }

        const body = request.body as {
            addSessionId?: string;
            response?: RegistrationResponseJSON;
        } | undefined;

        const addSessionId = body?.addSessionId?.trim();
        const regResponse = body?.response;

        if (!addSessionId || !regResponse) {
            return reply.status(400).send({ message: "addSessionId and response are required" });
        }

        const stored = authChallenges.get(addSessionId);
        if (!stored || Date.now() - stored.createdAt > 300000) {
            authChallenges.delete(addSessionId);
            return reply.status(400).send({ message: "Registration challenge expired or invalid" });
        }

        try {
            const verification = await verifyRegistrationResponse({
                response: regResponse,
                expectedChallenge: stored.challenge,
                expectedOrigin: allowedOrigins,
                expectedRPID: rpID,
            });

            if (!verification.verified || !verification.registrationInfo) {
                authChallenges.delete(addSessionId);
                return reply.status(400).send({ message: "WebAuthn registration verification failed" });
            }

            const { credential } = verification.registrationInfo;
            const webAuthnCredential = new WebAuthnCredentials(
                credential.id,
                session.userId,
                session.userType === "inspector" ? WebAuthnUserType.INSPECTOR : WebAuthnUserType.WORKER,
                isoBase64URL.fromBuffer(credential.publicKey),
                credential.counter,
                regResponse.response.transports as string[] | undefined,
            );
            await credRepo.register(webAuthnCredential);

            authChallenges.delete(addSessionId);
            return { success: true };
        } catch (err: unknown) {
            authChallenges.delete(addSessionId);
            const message = err instanceof Error ? err.message : "Failed to add passkey";
            return reply.status(400).send({ message });
        }
    });

    app.get("/api/auth/me", async (request, reply) => {
        const session = getSession(request);
        if (!session) {
            return reply.status(401).send({ message: "Not authenticated" });
        }
        return {
            id: session.userId,
            userId: session.userId,
            userType: session.userType,
            name: session.name,
            surname: session.surname,
            company: session.company,
            cf: session.cf,
        };
    });

    app.post("/api/auth/logout", async (request) => {
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.substring("Bearer ".length).trim();
            sessions.delete(token);
        }
        return { status: "ok" };
    });

    // ============================================================
    // WORKER ROUTES (/api/worker)
    // ============================================================

    app.get("/api/worker/license", async (request, reply) => {
        const session = getSession(request);
        if (!session || session.userType !== "worker") {
            return reply.status(401).send({ message: "Worker authentication required" });
        }

        const license = await licenseRepo.findByWorkerId(session.userId);
        if (!license) {
            return reply.status(404).send({ message: "License not found for worker" });
        }

        const isEligible = license.status === LicenseStatusEnum.ACTIVE && license.credits >= 15;

        // STRICT ZKP REQUIREMENT: Do NOT reveal raw numeric credits to Worker
        return {
            licenseRef: license.licenseRef,
            status: license.status,
            version: license.version,
            lastUpdated: license.updatedAt ? new Date(license.updatedAt).toLocaleString("it-IT") : "Recent",
            verificationEligibility: isEligible ? "ELIGIBLE" : "NOT_ELIGIBLE",
        };
    });

    app.get("/api/worker/credential", async (request, reply) => {
        const session = getSession(request);
        if (!session || session.userType !== "worker") {
            return reply.status(401).send({ message: "Worker authentication required" });
        }

        const license = await licenseRepo.findByWorkerId(session.userId);
        if (!license) {
            return reply.status(404).send({ message: "License not found for worker" });
        }

        try {
            const licenseRef = license.licenseRef ?? licenseRefService.generateLicenseRef(license.licenseId);
            const credential = await issuerService.issueLicenseCredential(session.userId, licenseRef);
            return credential;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to issue credential";
            return reply.status(500).send({ message });
        }
    });

    app.post("/api/worker/verify/challenge", async (request, reply) => {
        const session = getSession(request);
        if (!session || session.userType !== "worker") {
            return reply.status(401).send({ message: "Worker authentication required" });
        }

        const license = await licenseRepo.findByWorkerId(session.userId);
        if (!license) {
            return reply.status(404).send({ message: "License not found" });
        }

        try {
            const licenseRef = license.licenseRef ?? licenseRefService.generateLicenseRef(license.licenseId);
            const challenge = await challengeService.createChallenge(session.userId, licenseRef);
            return {
                challengeId: challenge.id,
                nonce: challenge.challenge,
                workerId: challenge.workerId,
                licenseRef: challenge.licenseRef,
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Challenge generation failed";
            return reply.status(500).send({ message });
        }
    });

    app.post("/api/worker/verify", async (request, reply) => {
        const session = getSession(request);
        if (!session || session.userType !== "worker") {
            return reply.status(401).send({ message: "Worker authentication required" });
        }

        const body = request.body as Partial<LicenseVerificationPayload> | undefined;

        try {
            const license = await licenseRepo.findByWorkerId(session.userId);
            if (!license) {
                return {
                    result: "NOT_PASS",
                    verifiedAt: new Date().toLocaleString("it-IT"),
                    reason: "License not found",
                };
            }

            if (verificationService && body?.proof && body?.publicSignals) {
                const outcome = await verificationService.verifyLicenseAccess({
                    proof: body.proof,
                    publicSignals: body.publicSignals,
                    licenseRef: license.licenseRef ?? "",
                    challengeId: body.challengeId || "",
                }, session.userId);
                return {
                    result: outcome.outcome === "PASS" ? "PASS" : "NOT_PASS",
                    verifiedAt: new Date().toLocaleString("it-IT"),
                    reason: outcome.reason,
                };
            }

            if (body?.challengeId) {
                try {
                    await challengeService.consumeChallenge(body.challengeId);
                } catch {
                    // Ignora se la challenge è già stata consumata o assente
                }
            }

            const isPass = license.status === LicenseStatusEnum.ACTIVE && license.credits >= 15;
            return {
                result: isPass ? "PASS" : "NOT_PASS",
                verifiedAt: new Date().toLocaleString("it-IT"),
                reason: isPass ? undefined : (license.status === LicenseStatusEnum.REVOKED ? "Patente revocata" : "Crediti insufficienti (< 15)"),
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Verification error";
            return {
                result: "NOT_PASS",
                verifiedAt: new Date().toLocaleString("it-IT"),
                reason: message,
            };
        }
    });

    // ============================================================
    // INSPECTOR ROUTES (/api/inspector)
    // ============================================================

    app.post("/api/inspector/verify", async (request, reply) => {
        const session = getSession(request);
        if (!session || session.userType !== "inspector") {
            return reply.status(401).send({ message: "Inspector authentication required" });
        }

        const body = request.body as { licenseRef?: string } | undefined;
        const licenseRef = body?.licenseRef?.trim();
        if (!licenseRef) {
            return reply.status(400).send({ message: "licenseRef is required" });
        }

        const license = await licenseRepo.findByLicenseRef(licenseRef);
        if (!license) {
            return {
                result: "NOT_PASS",
                verifiedAt: new Date().toLocaleString("it-IT"),
                reason: "License reference not found",
            };
        }

        const isPass = license.status === LicenseStatusEnum.ACTIVE && license.credits >= 15;
        return {
            result: isPass ? "PASS" : "NOT_PASS",
            verifiedAt: new Date().toLocaleString("it-IT"),
            status: license.status,
            reason: isPass ? undefined : (license.status === LicenseStatusEnum.REVOKED ? "License is revoked" : "Insufficient credits (< 15)"),
        };
    });

    app.post("/api/inspector/sanctions", async (request, reply) => {
        const session = getSession(request);
        if (!session || session.userType !== "inspector") {
            return reply.status(401).send({ message: "Inspector authentication required" });
        }

        const body = request.body as { licenseRef?: string; penalty?: number; reason?: string } | undefined;
        const licenseRef = body?.licenseRef?.trim();
        const penalty = Number(body?.penalty);
        const reason = body?.reason?.trim();

        if (!licenseRef || !reason || !penalty || penalty <= 0) {
            return reply.status(400).send({ message: "Valid licenseRef, penalty > 0 and reason are required" });
        }

        const license = await licenseRepo.findByLicenseRef(licenseRef);
        if (!license) {
            return reply.status(404).send({ message: "License not found" });
        }

        const sanctionId = `SANC-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

        // 1. Calcolo del nuovo stato privato della patente
        const newCredits = Math.max(0, license.credits - penalty);
        const newStatus = newCredits >= 15 ? LicenseStatusEnum.ACTIVE : LicenseStatusEnum.REVOKED;
        const newVersion = license.version + 1;
        const newLicenseRandomness = commitmentService.generateRandomness();

        // 2. Calcolo dei commitment crittografici (Poseidon per lo stato, SHA-256 per la sanzione)
        const newCommitment = await commitmentService.createCommitment({
            credits: newCredits,
            status: newStatus,
            version: newVersion,
        }, newLicenseRandomness);

        const sanctionRandomness = crypto.randomBytes(16).toString("hex");
        const sanctionCommitment = crypto.createHash("sha256")
            .update(JSON.stringify({
                sanctionId,
                licenseRef,
                penalty,
                reason,
                inspectorRef: session.userId,
                randomness: sanctionRandomness,
            }))
            .digest("hex");

        // 3. Ancoraggio OBBLIGATORIO su Blockchain (Hyperledger Fabric via FireFly)
        if (blockchainService) {
            try {
                // Assicura che la patente sia registrata on-chain (CreateLicense) prima della sanzione se non ancora presente
                const onChainState = await blockchainService.getLicenseState(licenseRef).catch(() => null);
                if (!onChainState) {
                    const initialCommitment = await commitmentService.createCommitment({
                        credits: license.credits,
                        status: license.status,
                        version: license.version,
                    }, license.randomness);
                    await blockchainService.createLicense(licenseRef, initialCommitment);
                }

                await blockchainService.issueSanction({
                    sanctionId,
                    licenseRef,
                    sanctionCommitment,
                    newCommitment,
                    inspectorRef: session.userId,
                });
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err);
                return reply.status(502).send({
                    message: `Errore Blockchain / FireFly: impossibile registrare la sanzione sul ledger immutabile (${message}). Verifica che FireFly e la blockchain siano attivi.`,
                });
            }
        }

        // 4. Solo a conferma blockchain (o in test isolati senza blockchainService), persiste nel DB
        const sanction = new Sanction({
            id: sanctionId,
            licenseRef,
            penalty,
            reason,
            inspectorRef: session.userId,
            issuedAt: new Date(),
            randomness: sanctionRandomness,
        });

        await sanctionRepo.save(sanction);

        const updatedLicense = new PrivateLicenseState(
            license.licenseId,
            newCredits,
            newStatus,
            newLicenseRandomness,
            newVersion,
            license.workerId,
            license.licenseRef,
            license.createdAt,
            new Date(),
        );
        await licenseRepo.update(updatedLicense);

        return {
            sanctionId: sanction.id,
            licenseRef: sanction.licenseRef,
            penalty: sanction.penalty,
            reason: sanction.reason,
            issuedAt: sanction.issuedAt.toLocaleString("it-IT"),
            inspectorRef: sanction.inspectorRef,
            blockchainTx: blockchainService ? "CONFIRMED" : "SKIPPED_DEV",
        };
    });

    app.get("/api/inspector/sanctions", async (request, reply) => {
        const session = getSession(request);
        if (!session || session.userType !== "inspector") {
            return reply.status(401).send({ message: "Inspector authentication required" });
        }

        const query = request.query as { licenseRef?: string } | undefined;
        let sanctions: Sanction[];

        if (query?.licenseRef?.trim()) {
            sanctions = await sanctionRepo.findByLicenseRef(query.licenseRef.trim());
        } else {
            sanctions = await sanctionRepo.findByInspectorRef(session.userId);
            // Se l'ispettore non ha ancora emesso sanzioni proprie, mostra tutte le sanzioni del cantiere demo
            if (sanctions.length === 0) {
                const defaultRef = licenseRefService.generateLicenseRef("LIC-001");
                sanctions = await sanctionRepo.findByLicenseRef(defaultRef);
            }
        }

        return sanctions.map((s) => ({
            sanctionId: s.id,
            licenseRef: s.licenseRef,
            penalty: s.penalty,
            reason: s.reason,
            issuedAt: new Date(s.issuedAt).toLocaleString("it-IT"),
            inspectorRef: s.inspectorRef,
        }));
    });

    app.get("/api/inspector/sanctions/:id", async (request, reply) => {
        const session = getSession(request);
        if (!session || session.userType !== "inspector") {
            return reply.status(401).send({ message: "Inspector authentication required" });
        }

        const params = request.params as { id: string };
        const sanction = await sanctionRepo.findById(params.id);
        if (!sanction) {
            return reply.status(404).send({ message: "Sanction not found" });
        }

        return {
            sanctionId: sanction.id,
            licenseRef: sanction.licenseRef,
            penalty: sanction.penalty,
            reason: sanction.reason,
            issuedAt: new Date(sanction.issuedAt).toLocaleString("it-IT"),
            inspectorRef: sanction.inspectorRef,
        };
    });

    // ============================================================
    // PUBLIC VERIFICATION ROUTE (/api/public/credential/verify)
    // ============================================================

    app.post("/api/public/credential/verify", async (request) => {
        const body = request.body as { credentialData?: unknown } | undefined;
        let credentialObj = body?.credentialData;

        if (typeof credentialObj === "string") {
            try {
                credentialObj = JSON.parse(credentialObj);
            } catch {
                return {
                    result: "NOT_PASS",
                    verifiedAt: new Date().toLocaleString("it-IT"),
                    reason: "Malformed JSON credential data",
                };
            }
        }

        if (!credentialObj || typeof credentialObj !== "object") {
            return {
                result: "NOT_PASS",
                verifiedAt: new Date().toLocaleString("it-IT"),
                reason: "Invalid credential format",
            };
        }

        const cred = credentialObj as unknown as WorksiteLicenseCredential;
        const isValid = await verifierService.verifyCredential(cred);

        return {
            result: isValid ? "PASS" : "NOT_PASS",
            verifiedAt: new Date().toLocaleString("it-IT"),
            credentialSubject: cred.credentialSubject,
            issuer: cred.issuer,
            reason: isValid ? undefined : "Cryptographic signature or credential structure is invalid",
        };
    });

    return app;
}
