/**
 * @file inspector.routes.ts
 * @description Controller delle rotte dedicate agli ispettori di cantiere (ASL, INL).
 * Permette la verifica ispettiva dello stato di una patente (tramite licenseRef o Fabric ledger),
 * l'emissione di sanzioni con decurtazione crediti e notarizzazione immutabile on-chain, e la consultazione dello storico sanzioni.
 *
 * @dependencies
 * - fastify: framework HTTP per la definizione delle rotte REST.
 * - repositories/*: persistenza di patenti e sanzioni.
 * - security/zkp/*: calcolo nuovo commitment Poseidon post-sanzione e validazione licenseRef.
 * - security/blockchain/blockchain.service.js: emissione sanzione e aggiornamento commitment on-chain.
 * - middlewares/auth-guard.js: controllo di accesso per ruolo 'inspector'.
 */

import crypto from "node:crypto";
import { type FastifyInstance } from "fastify";
import { type LicenseRepository } from "../repositories/license-repository.js";
import { type SanctionRepository } from "../repositories/sanction-repository.js";
import { LicenseStatusEnum } from "../domain/license.js";
import { PrivateLicenseState } from "../domain/private-license-state.js";
import { Sanction } from "../domain/sanction.js";
import { type CommitmentService } from "../security/zkp/commitment.service.js";
import { type BlockchainService } from "../security/blockchain/blockchain.service.js";
import { type LicenseReferenceService } from "../security/zkp/license-reference.service.js";
import { type SessionManager } from "../security/webauthn/session-manager.js";
import { requireInspector } from "../middlewares/auth-guard.js";

/**
 * Dipendenze necessarie per i servizi di ispezione e vigilanza.
 */
export interface InspectorRoutesContext {
    licenseRepo: LicenseRepository;
    sanctionRepo: SanctionRepository;
    commitmentService: CommitmentService;
    licenseRefService: LicenseReferenceService;
    blockchainService?: BlockchainService | undefined;
    sessionManager: SessionManager;
}

/**
 * Registra le rotte dell'ispettorato del lavoro nell'istanza Fastify.
 * @param app Istanza Fastify
 * @param ctx Servizi e repository ispettivi
 */
export function registerInspectorRoutes(app: FastifyInstance, ctx: InspectorRoutesContext): void {
    const {
        licenseRepo,
        sanctionRepo,
        commitmentService,
        licenseRefService,
        blockchainService,
        sessionManager,
    } = ctx;

    // 1. Verifica conformità patente tramite licenseRef pseudonimo
    app.post("/api/inspector/verify", async (request, reply) => {
        const session = requireInspector(request, reply, sessionManager);
        if (!session) return;

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

    // 2. Emissione sanzione con ancoraggio su blockchain e aggiornamento stato privato
    app.post("/api/inspector/sanctions", async (request, reply) => {
        const session = requireInspector(request, reply, sessionManager);
        if (!session) return;

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

        // 1. Calcolo del nuovo stato privato
        const newCredits = Math.max(0, license.credits - penalty);
        const newStatus = newCredits >= 15 ? LicenseStatusEnum.ACTIVE : LicenseStatusEnum.REVOKED;
        const newVersion = license.version + 1;
        const newLicenseRandomness = commitmentService.generateRandomness();

        // 2. Calcolo dei commitment crittografici
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

        // 3. Ancoraggio su Blockchain (Hyperledger Fabric via FireFly)
        if (blockchainService) {
            try {
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

        // 4. Persistenza nel database off-chain
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

    // 3. Consultazione sanzioni
    app.get("/api/inspector/sanctions", async (request, reply) => {
        const session = requireInspector(request, reply, sessionManager);
        if (!session) return;

        const query = request.query as { licenseRef?: string } | undefined;
        let sanctions: Sanction[];

        if (query?.licenseRef?.trim()) {
            sanctions = await sanctionRepo.findByLicenseRef(query.licenseRef.trim());
        } else {
            sanctions = await sanctionRepo.findByInspectorRef(session.userId);
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

    // 4. Dettaglio singola sanzione
    app.get("/api/inspector/sanctions/:id", async (request, reply) => {
        const session = requireInspector(request, reply, sessionManager);
        if (!session) return;

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
}
