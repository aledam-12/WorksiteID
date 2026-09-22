/**
 * @file auth.routes.ts
 * @description Controller delle rotte di autenticazione WebAuthn FIDO2 e gestione sessioni utente.
 * Gestisce la registrazione a due fasi con passkey, il login biometrico passwordless, l'aggiunta di nuove chiavi,
 * l'ispezione della sessione corrente (/api/auth/me) e il logout.
 *
 * @dependencies
 * - fastify: framework HTTP per la registrazione degli endpoint REST.
 * - @simplewebauthn/server: tipi delle risposte di registrazione e login WebAuthn.
 * - repositories/*: persistenza di utenti, lavoratori, ispettori e credenziali passkey.
 * - security/webauthn/*: servizi di autenticazione FIDO2 e session manager.
 * - security/zkp/*: servizi di inizializzazione patente (licenseRef, Poseidon commitment).
 * - middlewares/auth-guard.js: protezione delle rotte autenticate.
 */

import crypto from "node:crypto";
import { type FastifyInstance } from "fastify";
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { type UserRepository } from "../repositories/user-repository.js";
import { type WorkerRepository } from "../repositories/worker-repository.js";
import { type InspectorRepository } from "../repositories/inspector-repository.js";
import { type WebAuthnCredentialRepository } from "../repositories/webauthn-credential-repository.js";
import { type LicenseRepository } from "../repositories/license-repository.js";
import { User } from "../domain/user.js";
import { Worker } from "../domain/worker.js";
import { Inspector } from "../domain/inspector.js";
import { LicenseStatusEnum } from "../domain/license.js";
import { PrivateLicenseState } from "../domain/private-license-state.js";
import { WebAuthnCredentials, WebAuthnUserType } from "../domain/webauthn-credentials.js";
import { type LicenseReferenceService } from "../security/zkp/license-reference.service.js";
import { type CommitmentService } from "../security/zkp/commitment.service.js";
import { type BlockchainService } from "../security/blockchain/blockchain.service.js";
import { type WebAuthnService } from "../security/webauthn/webauthn.service.js";
import { type SessionData, SessionManager } from "../security/webauthn/session-manager.js";
import { requireAuth } from "../middlewares/auth-guard.js";

/**
 * Contesto delle dipendenze necessarie per le rotte di autenticazione.
 */
export interface AuthRoutesContext {
    userRepo: UserRepository;
    workerRepo: WorkerRepository;
    inspectorRepo: InspectorRepository;
    credRepo: WebAuthnCredentialRepository;
    licenseRepo: LicenseRepository;
    licenseRefService: LicenseReferenceService;
    commitmentService: CommitmentService;
    blockchainService?: BlockchainService | undefined;
    webAuthnService: WebAuthnService;
    sessionManager: SessionManager;
}

/**
 * Registra gli endpoint di autenticazione WebAuthn nell'istanza Fastify.
 * @param app Istanza del server Fastify
 * @param ctx Contesto contenente repository e servizi di sicurezza
 */
export function registerAuthRoutes(app: FastifyInstance, ctx: AuthRoutesContext): void {
    const {
        userRepo,
        workerRepo,
        inspectorRepo,
        credRepo,
        licenseRepo,
        licenseRefService,
        commitmentService,
        blockchainService,
        webAuthnService,
        sessionManager,
    } = ctx;

    // 1. Registrazione Fase 1: creazione options crittografiche WebAuthn FIDO2
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

        const options = await webAuthnService.generateRegistrationOptions({
            userId: assignedId,
            userName: `${name} ${surname} (${cf})`,
        });

        sessionManager.savePendingRegistration(pendingRegistrationId, {
            workerId: assignedId,
            name,
            surname,
            cf,
            company: company || (userType === "inspector" ? "Ispettorato di Vigilanza" : "Cantiere"),
            userType,
            challenge: options.challenge,
        });

        return {
            pendingRegistrationId,
            options,
        };
    });

    // 2. Registrazione Fase 2: verifica firma WebAuthn e persistenza atomica
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

        const pending = sessionManager.getPendingRegistration(pendingId);
        if (!pending) {
            return reply.status(400).send({ message: "Registration session expired or not found. Please start registration again." });
        }

        try {
            const verification = await webAuthnService.verifyRegistrationResponse({
                response: regResponse,
                expectedChallenge: pending.challenge,
            });

            if (!verification.verified || !verification.registrationInfo) {
                sessionManager.deletePendingRegistration(pendingId);
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
                const licenseId = `LIC-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
                const licenseRef = licenseRefService.generateLicenseRef(licenseId);
                const randomness = commitmentService.generateRandomness();

                // Registrazione dello stato iniziale su Blockchain se attiva
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

            const userProfile: SessionData = {
                userId: pending.workerId,
                userType: isInspector ? "inspector" : "worker",
                name: pending.name,
                surname: pending.surname,
                company: isInspector ? "Ispettorato di Vigilanza" : pending.company,
                cf: pending.cf,
            };

            const sessionId = sessionManager.createSession(userProfile);
            sessionManager.deletePendingRegistration(pendingId);

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
            sessionManager.deletePendingRegistration(pendingId);
            const message = err instanceof Error ? err.message : "Registration failed";
            return reply.status(400).send({ message });
        }
    });

    // 3. Login WebAuthn: Generazione opzioni di autenticazione FIDO2
    app.post("/api/auth/webauthn/options", async () => {
        const authSessionId = crypto.randomUUID();
        const options = await webAuthnService.generateAuthenticationOptions();
        sessionManager.saveAuthChallenge(authSessionId, options.challenge);

        return {
            options,
            authSessionId,
        };
    });

    // 4. Login WebAuthn: Verifica firma biometrica / passkey e rilascio sessione
    app.post("/api/auth/webauthn/verify", async (request, reply) => {
        const body = request.body as {
            authSessionId?: string;
            response?: AuthenticationResponseJSON;
        } | undefined;

        const authSessionId = body?.authSessionId?.trim();
        const authResponse = body?.response;

        if (!authSessionId || !authResponse || !authResponse.id) {
            return reply.status(400).send({ message: "authSessionId and credential response are required" });
        }

        const storedChallenge = sessionManager.consumeAuthChallenge(authSessionId);
        if (!storedChallenge) {
            return reply.status(400).send({ message: "Authentication challenge expired or invalid" });
        }

        const cred = await credRepo.findById(authResponse.id);
        if (!cred) {
            return reply.status(401).send({ message: "Passkey credential not recognized by WorksiteID" });
        }

        try {
            const verification = await webAuthnService.verifyAuthenticationResponse({
                response: authResponse,
                expectedChallenge: storedChallenge,
                credential: {
                    id: cred.id,
                    publicKey: cred.publicKey,
                    counter: cred.counter,
                },
            });

            if (!verification.verified || !verification.authenticationInfo) {
                return reply.status(401).send({ message: "WebAuthn authentication verification failed" });
            }

            if (credRepo.updateCounter && verification.authenticationInfo.newCounter > cred.counter) {
                await credRepo.updateCounter(cred.id, verification.authenticationInfo.newCounter);
            } else if (verification.authenticationInfo.newCounter > cred.counter) {
                cred.updateCounter(verification.authenticationInfo.newCounter);
            }

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

            const userProfile: SessionData = {
                userId: cred.userId,
                userType: cred.userType === WebAuthnUserType.INSPECTOR ? "inspector" : "worker",
                name,
                surname,
                company,
                cf,
            };

            const sessionId = sessionManager.createSession(userProfile);

            return {
                user: {
                    id: userProfile.userId,
                    ...userProfile,
                },
                sessionId,
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Authentication failed";
            return reply.status(401).send({ message });
        }
    });

    // 5. Multi-Device: Aggiunta nuova Passkey a account autenticato
    app.post("/api/auth/webauthn/credentials/add-options", async (request, reply) => {
        const session = requireAuth(request, reply, sessionManager, "Authentication required to add a new passkey");
        if (!session) return;

        const addSessionId = crypto.randomUUID();
        const existingCreds = await credRepo.findByUserId(session.userId);

        const options = await webAuthnService.generateRegistrationOptions({
            userId: session.userId,
            userName: `${session.name} ${session.surname}`,
            excludeCredentialIds: existingCreds.map((c) => c.id),
        });

        sessionManager.saveAuthChallenge(addSessionId, options.challenge);

        return {
            options,
            addSessionId,
        };
    });

    app.post("/api/auth/webauthn/credentials/add-complete", async (request, reply) => {
        const session = requireAuth(request, reply, sessionManager, "Authentication required to add a new passkey");
        if (!session) return;

        const body = request.body as {
            addSessionId?: string;
            response?: RegistrationResponseJSON;
        } | undefined;

        const addSessionId = body?.addSessionId?.trim();
        const regResponse = body?.response;

        if (!addSessionId || !regResponse) {
            return reply.status(400).send({ message: "addSessionId and response are required" });
        }

        const storedChallenge = sessionManager.consumeAuthChallenge(addSessionId);
        if (!storedChallenge) {
            return reply.status(400).send({ message: "Registration challenge expired or invalid" });
        }

        try {
            const verification = await webAuthnService.verifyRegistrationResponse({
                response: regResponse,
                expectedChallenge: storedChallenge,
            });

            if (!verification.verified || !verification.registrationInfo) {
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

            return { success: true };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to add passkey";
            return reply.status(400).send({ message });
        }
    });

    // 6. Profilo utente corrente autenticato
    app.get("/api/auth/me", async (request, reply) => {
        const session = requireAuth(request, reply, sessionManager);
        if (!session) return;

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

    // 7. Logout e invalidazione della sessione
    app.post("/api/auth/logout", async (request) => {
        const token = sessionManager.extractBearerToken(request.headers.authorization);
        if (token) {
            sessionManager.deleteSession(token);
        }
        return { status: "ok" };
    });
}
