/**
 * @file license-verification.service.ts
 * @description Servizio orchestratore per la verifica dell'accesso al varco del cantiere.
 * Coordina la validazione dei segnali pubblici ZKP, l'integrità anti-replay delle challenge,
 * la corrispondenza con lo stato on-chain su Hyperledger Fabric e la verifica crittografica Groth16.
 *
 * @dependencies
 * - security/blockchain/blockchain.service.js: interrogazione del ledger immutabile Fabric.
 * - security/zkp/zkp.service.js: verifica crittografica della prova a conoscenza zero Groth16.
 * - security/zkp/challenge.service.js: gestione del ciclo di vita della sfida anti-replay.
 * - domain/zkp.js: tipi di payload, esiti di verifica e parsing dei segnali pubblici.
 */

import { type BlockchainService } from "../blockchain/blockchain.service.js";
import { type ZkpService } from "./zkp.service.js";
import { type ChallengeService } from "./challenge.service.js";
import {
    type LicenseVerificationPayload,
    parsePublicSignals,
    VerificationOutcome,
    type VerificationResult,
} from "../../domain/zkp.js";

/**
 * Contratto per il servizio di orchestrazione della verifica al varco di cantiere.
 */
export interface LicenseVerificationService {
    /**
     * Esegue la verifica completa a più livelli per l'accesso del lavoratore al varco.
     *
     * @param payload Dati della prova ZKP, segnali pubblici, challengeId e licenseRef
     * @param authenticatedWorkerId ID del lavoratore ricavato dalla sessione WebAuthn
     * @returns Risultato della verifica con esito (PASS/NOT_PASS) ed eventuale motivazione
     */
    verifyLicenseAccess(
        payload: LicenseVerificationPayload,
        authenticatedWorkerId?: string,
    ): Promise<VerificationResult>;
}

/**
 * Implementazione concreta dell'orchestratore di verifica varco.
 */
export class LicenseVerificationServiceImpl
    implements LicenseVerificationService
{
    /**
     * Costruttore dell'orchestratore con iniezione delle dipendenze di sicurezza.
     *
     * @param blockchainService Client per l'accesso al ledger Fabric
     * @param zkpService Servizio di verifica matematica Groth16
     * @param challengeService Gestore sfide anti-replay
     */
    constructor(
        private readonly blockchainService: BlockchainService,
        private readonly zkpService: ZkpService,
        private readonly challengeService: ChallengeService,
    ) {}

    /**
     * Verifica l'accesso al cantiere seguendo il flusso di sicurezza a 7 passaggi:
     * 1. Validazione payload formale
     * 2. Parsing dei segnali pubblici ZKP
     * 3. Verifica della challenge monouso (anti-replay)
     * 4. Recupero dello stato della patente dal ledger Fabric
     * 5. Coerenza tra commitment on-chain e commitment della prova
     * 6. Verifica crittografica SnarkJS/Groth16
     * 7. Consumo irreversibile della challenge
     */
    async verifyLicenseAccess(
        payload: LicenseVerificationPayload,
        authenticatedWorkerId?: string,
    ): Promise<VerificationResult> {
        if (!payload || typeof payload !== "object") {
            return {
                outcome: VerificationOutcome.NOT_PASS,
                reason: "Invalid verification payload",
            };
        }

        const workerId = authenticatedWorkerId?.trim();
        if (!workerId) {
            return {
                outcome: VerificationOutcome.NOT_PASS,
                reason: "Authenticated worker ID is required",
            };
        }

        if (!payload.licenseRef || payload.licenseRef.trim() === "") {
            return {
                outcome: VerificationOutcome.NOT_PASS,
                reason: "License reference is required",
            };
        }

        if (!payload.challengeId || payload.challengeId.trim() === "") {
            return {
                outcome: VerificationOutcome.NOT_PASS,
                reason: "Challenge ID is required",
            };
        }

        const normalizedLicenseRef = payload.licenseRef.trim();

        // 1. Parsing e validazione formale dei segnali pubblici
        let publicSignals;
        try {
            publicSignals = parsePublicSignals(payload.publicSignals);
        } catch (err) {
            return {
                outcome: VerificationOutcome.NOT_PASS,
                reason: (err as Error).message || "Invalid public signals format",
            };
        }

        // 2. Validazione challenge (esistenza, anti-replay, corrispondenza)
        try {
            await this.challengeService.validateChallenge(
                payload.challengeId,
                workerId,
                normalizedLicenseRef,
                publicSignals.challenge,
            );
        } catch (err) {
            return {
                outcome: VerificationOutcome.NOT_PASS,
                reason: (err as Error).message,
            };
        }

        // 3. Recupero autoritativo dello stato della patente da Fabric
        let onChainState;
        try {
            onChainState = await this.blockchainService.getLicenseState(
                normalizedLicenseRef,
            );
        } catch (err) {
            return {
                outcome: VerificationOutcome.NOT_PASS,
                reason: `Blockchain retrieval error: ${(err as Error).message}`,
            };
        }

        if (!onChainState) {
            return {
                outcome: VerificationOutcome.NOT_PASS,
                reason: `License not found on ledger: ${normalizedLicenseRef}`,
            };
        }

        // 4. Verifica di coerenza con il ledger
        if (onChainState.commitment.trim() !== publicSignals.commitment.trim()) {
            return {
                outcome: VerificationOutcome.NOT_PASS,
                reason: "Commitment mismatch: proof commitment differs from on-chain ledger commitment",
            };
        }

        // 5. Verifica crittografica Groth16 della prova ZKP
        const isProofValid = await this.zkpService.verifyProof(
            payload.proof,
            publicSignals,
        );

        if (!isProofValid) {
            return {
                outcome: VerificationOutcome.NOT_PASS,
                reason: "Invalid Groth16 proof or public signals mismatch",
            };
        }

        // 6. Consumo della challenge (anti-replay)
        try {
            await this.challengeService.consumeChallenge(payload.challengeId);
        } catch (err) {
            return {
                outcome: VerificationOutcome.NOT_PASS,
                reason: (err as Error).message,
            };
        }

        // 7. Esito finale PASS
        return {
            outcome: VerificationOutcome.PASS,
        };
    }
}
