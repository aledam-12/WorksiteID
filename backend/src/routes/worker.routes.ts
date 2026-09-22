/**
 * @file worker.routes.ts
 * @description Controller delle rotte dedicate ai lavoratori di cantiere.
 * Gestisce la consultazione privacy-preserving della patente, l'emissione della Verifiable Credential W3C,
 * la richiesta di challenge anti-replay per il varco e la sottomissione della prova a conoscenza zero (ZKP).
 *
 * @dependencies
 * - fastify: framework HTTP per la definizione delle rotte REST.
 * - repositories/license-repository.js: lettura dello stato della patente.
 * - security/vc/vc-issuer.service.js: emissione della patente come credenziale verificabile firmata.
 * - security/zkp/*: generazione sfide e verifica ZKP per l'accesso al varco.
 * - middlewares/auth-guard.js: verifica del ruolo 'worker'.
 */

import { type FastifyInstance } from "fastify";
import { type LicenseRepository } from "../repositories/license-repository.js";
import { LicenseStatusEnum } from "../domain/license.js";
import { type CredentialIssuerService } from "../security/vc/vc-issuer.service.js";
import { type ChallengeService } from "../security/zkp/challenge.service.js";
import { type LicenseVerificationService } from "../security/zkp/license-verification.service.js";
import { type LicenseReferenceService } from "../security/zkp/license-reference.service.js";
import { type LicenseVerificationPayload } from "../domain/zkp.js";
import { type SessionManager } from "../security/webauthn/session-manager.js";
import { requireWorker } from "../middlewares/auth-guard.js";

/**
 * Dipendenze necessarie per i servizi di cantiere del lavoratore.
 */
export interface WorkerRoutesContext {
    licenseRepo: LicenseRepository;
    issuerService: CredentialIssuerService;
    challengeService: ChallengeService;
    licenseRefService: LicenseReferenceService;
    verificationService?: LicenseVerificationService | undefined;
    sessionManager: SessionManager;
}

/**
 * Registra le rotte riservate ai lavoratori di cantiere nell'applicazione Fastify.
 * @param app Istanza Fastify
 * @param ctx Servizi di supporto per lavoratori
 */
export function registerWorkerRoutes(app: FastifyInstance, ctx: WorkerRoutesContext): void {
    const {
        licenseRepo,
        issuerService,
        challengeService,
        licenseRefService,
        verificationService,
        sessionManager,
    } = ctx;

    // 1. Consultazione stato patente (Privacy-Preserving: nessun credito grezzo esposto)
    app.get("/api/worker/license", async (request, reply) => {
        const session = requireWorker(request, reply, sessionManager);
        if (!session) return;

        const license = await licenseRepo.findByWorkerId(session.userId);
        if (!license) {
            return reply.status(404).send({ message: "License not found for worker" });
        }

        const isEligible = license.status === LicenseStatusEnum.ACTIVE && license.credits >= 15;

        return {
            licenseRef: license.licenseRef,
            status: license.status,
            version: license.version,
            lastUpdated: license.updatedAt ? new Date(license.updatedAt).toLocaleString("it-IT") : "Recent",
            verificationEligibility: isEligible ? "ELIGIBLE" : "NOT_ELIGIBLE",
        };
    });

    // 2. Rilascio Verifiable Credential (VC W3C firmata con Ed25519)
    app.get("/api/worker/credential", async (request, reply) => {
        const session = requireWorker(request, reply, sessionManager);
        if (!session) return;

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

    // 3. Richiesta challenge per la prova ZKP al varco d'accesso
    app.post("/api/worker/verify/challenge", async (request, reply) => {
        const session = requireWorker(request, reply, sessionManager);
        if (!session) return;

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

    // 4. Invio della prova ZKP Groth16 e verifica dell'accesso
    app.post("/api/worker/verify", async (request, reply) => {
        const session = requireWorker(request, reply, sessionManager);
        if (!session) return;

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
}
