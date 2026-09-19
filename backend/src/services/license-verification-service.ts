import { BlockchainService } from "./blockchain-service.js";
import { ZkpService } from "./zkp-service.js";
import { ChallengeService } from "./challenge-service.js";
import {
    LicenseVerificationPayload,
    parsePublicSignals,
    VerificationOutcome,
    VerificationResult,
} from "../domain/zkp.js";

/**
 * Servizio di orchestrazione per la verifica dell'accesso al cantiere (varco).
 * Coordina la validazione dei segnali pubblici, l'anti-replay, l'interrogazione
 * della blockchain Hyperledger Fabric e la verifica crittografica Groth16.
 */
export interface LicenseVerificationService {
    /**
     * Esegue la pipeline di verifica dell'accesso per la patente del lavoratore.
     *
     * @param payload Dati della prova ZKP, segnali pubblici, riferimento patente e ID challenge
     * @param authenticatedWorkerId ID del lavoratore ricavato dalla sessione WebAuthn autenticata
     * @returns Risultato di verifica contenente l'esito (PASS / NOT_PASS) e l'eventuale motivazione
     */
    verifyLicenseAccess(
        payload: LicenseVerificationPayload,
        authenticatedWorkerId?: string,
    ): Promise<VerificationResult>;
}

export class LicenseVerificationServiceImpl
    implements LicenseVerificationService
{
    constructor(
        private readonly blockchainService: BlockchainService,
        private readonly zkpService: ZkpService,
        private readonly challengeService: ChallengeService,
    ) {}

    /**
     * Esegue la verifica autorizzativa completa al varco in 7 passaggi logici:
     *
     * 1. Validazione sintattica del payload e dei segnali pubblici.
     * 2. Validazione di sicurezza della challenge monouso (anti-replay).
     * 3. Interrogazione di Hyperledger Fabric per recuperare lo stato on-chain autoritativo.
     * 4. Controllo di coerenza: il commitment pubblico della prova deve corrispondere a quello sul ledger.
     * 5. Verifica crittografica Groth16 tramite SnarkJS.
     * 6. Consumo della challenge (la sfida non potrà più essere riutilizzata).
     * 7. Restituzione dell'esito autorizzativo (PASS) nel rispetto della minimizzazione dei dati (GDPR).
     *
     * @param payload Contiene la prova Groth16, i segnali pubblici e i riferimenti
     * @param authenticatedWorkerId Identificativo del lavoratore verificato a monte (es. WebAuthn)
     * @returns VerificationResult con esito PASS oppure NOT_PASS
     */
    async verifyLicenseAccess(
        payload: LicenseVerificationPayload,
        authenticatedWorkerId?: string,
    ): Promise<VerificationResult> {
        // Controllo validità dell'oggetto payload
        if (!payload || typeof payload !== "object") {
            return {
                outcome: VerificationOutcome.NOT_PASS,
                reason: "Invalid verification payload",
            };
        }

        // L'identità del Worker deve provenire esclusivamente dalla sessione autenticata (authenticatedWorkerId).
        // Il workerId eventualmente presente nel payload non è attendibile e non può sostituire la sessione.
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

        // -------------------------------------------------------------
        // PASSO 1: Parsing e validazione formale dei segnali pubblici
        // -------------------------------------------------------------
        let publicSignals;
        try {
            publicSignals = parsePublicSignals(payload.publicSignals);
        } catch (err) {
            return {
                outcome: VerificationOutcome.NOT_PASS,
                reason: (err as Error).message || "Invalid public signals format",
            };
        }

        // -------------------------------------------------------------
        // PASSO 2: Validazione challenge (esistenza, anti-replay, corrispondenza)
        // -------------------------------------------------------------
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

        // -------------------------------------------------------------
        // PASSO 3: Recupero autoritativo dello stato della patente da Fabric
        // -------------------------------------------------------------
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

        // -------------------------------------------------------------
        // PASSO 4: Verifica di coerenza con il ledger
        // Se la patente è stata sanzionata, il commitment on-chain è cambiato:
        // una prova calcolata su uno stato precedente risulterà respinta.
        // -------------------------------------------------------------
        if (onChainState.commitment.trim() !== publicSignals.commitment.trim()) {
            return {
                outcome: VerificationOutcome.NOT_PASS,
                reason: "Commitment mismatch: proof commitment differs from on-chain ledger commitment",
            };
        }

        // -------------------------------------------------------------
        // PASSO 5: Verifica crittografica Groth16 della prova ZKP
        // -------------------------------------------------------------
        const isProofValid = await this.zkpService.verifyProof(
            payload.proof,
            publicSignals,
        );

        if (!isProofValid) {
            // Se la prova fallisce, la challenge NON viene consumata
            return {
                outcome: VerificationOutcome.NOT_PASS,
                reason: "Invalid Groth16 proof or public signals mismatch",
            };
        }

        // -------------------------------------------------------------
        // PASSO 6: Consumo della challenge (garanzia di monouso / single-use)
        // -------------------------------------------------------------
        try {
            await this.challengeService.consumeChallenge(payload.challengeId);
        } catch (err) {
            return {
                outcome: VerificationOutcome.NOT_PASS,
                reason: (err as Error).message,
            };
        }

        // -------------------------------------------------------------
        // PASSO 7: Esito finale PASS
        // Nessun dato privato (crediti, witness, randomness) viene restituito o registrato
        // -------------------------------------------------------------
        return {
            outcome: VerificationOutcome.PASS,
        };
    }
}
