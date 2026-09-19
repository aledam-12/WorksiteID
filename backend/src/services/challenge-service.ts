import { randomBytes, randomUUID } from "node:crypto";
import {
    InvalidChallengeError,
    ReplayedChallengeError,
} from "../domain/zkp-errors.js";

/**
 * Rappresenta la sfida (challenge) generata dal server per la verifica d'accesso.
 */
export interface VerificationChallenge {
    /** Identificativo univoco della richiesta */
    id: string;
    /** Valore numerico casuale della sfida */
    challenge: string;
    /** ID del lavoratore */
    workerId: string;
    /** Riferimento della patente */
    licenseRef: string;
    /** Indica se la challenge è già stata usata con successo */
    used: boolean;
}

/**
 * Servizio per gestire le challenge monouso (anti-replay).
 */
export interface ChallengeService {
    /**
     * Crea una nuova challenge per un lavoratore e una patente.
     * Se il lavoratore ne ha già una non usata, viene sostituita dalla nuova.
     *
     * @param workerId ID del lavoratore
     * @param licenseRef Riferimento della patente
     * @returns Oggetto VerificationChallenge
     */
    createChallenge(
        workerId: string,
        licenseRef: string,
    ): Promise<VerificationChallenge>;

    /**
     * Recupera una challenge dato il suo ID.
     *
     * @param challengeId ID della challenge
     * @returns La challenge trovata oppure null
     */
    getChallenge(challengeId: string): Promise<VerificationChallenge | null>;

    /**
     * Controlla che la challenge esista, non sia stata già usata e appartenga al lavoratore corretto.
     *
     * @param challengeId ID della challenge da verificare
     * @param expectedWorkerId ID del lavoratore atteso
     * @param expectedLicenseRef Riferimento della patente atteso
     * @param expectedValue Valore numerico della challenge atteso
     * @returns Record della challenge validata
     * @throws InvalidChallengeError se la challenge non esiste o non corrisponde
     * @throws ReplayedChallengeError se la challenge è già stata usata
     */
    validateChallenge(
        challengeId: string,
        expectedWorkerId?: string,
        expectedLicenseRef?: string,
        expectedValue?: string,
    ): Promise<VerificationChallenge>;

    /**
     * Segna la challenge come usata per evitare che venga riutilizzata.
     *
     * @param challengeId ID della challenge da consumare
     */
    consumeChallenge(challengeId: string): Promise<void>;
}

export class ChallengeServiceImpl implements ChallengeService {
    /** Salva le challenge generate indicizzate per ID */
    private readonly challenges: Map<string, VerificationChallenge> = new Map();

    /** Mappa lavoratore -> ID challenge attiva per consentire una sola challenge per utente */
    private readonly workerActiveChallenge: Map<string, string> = new Map();

    async createChallenge(
        workerId: string,
        licenseRef: string,
    ): Promise<VerificationChallenge> {
        if (!workerId || workerId.trim() === "") {
            throw new Error("Worker ID must not be empty");
        }
        if (!licenseRef || licenseRef.trim() === "") {
            throw new Error("License reference must not be empty");
        }

        const normalizedWorkerId = workerId.trim();
        const normalizedLicenseRef = licenseRef.trim();

        // Se l'utente aveva già una challenge attiva, la eliminiamo
        const existingChallengeId = this.workerActiveChallenge.get(normalizedWorkerId);
        if (existingChallengeId) {
            this.challenges.delete(existingChallengeId);
            this.workerActiveChallenge.delete(normalizedWorkerId);
        }

        // Generiamo un ID univoco e un numero casuale a 31 byte
        const id = randomUUID();
        const bytes = randomBytes(31);
        const challenge = BigInt("0x" + bytes.toString("hex")).toString();

        const record: VerificationChallenge = {
            id,
            challenge,
            workerId: normalizedWorkerId,
            licenseRef: normalizedLicenseRef,
            used: false,
        };

        this.challenges.set(id, record);
        this.workerActiveChallenge.set(normalizedWorkerId, id);

        return { ...record };
    }

    async getChallenge(
        challengeId: string,
    ): Promise<VerificationChallenge | null> {
        if (!challengeId || challengeId.trim() === "") {
            return null;
        }
        const record = this.challenges.get(challengeId.trim());
        return record ? { ...record } : null;
    }

    async validateChallenge(
        challengeId: string,
        expectedWorkerId?: string,
        expectedLicenseRef?: string,
        expectedValue?: string,
    ): Promise<VerificationChallenge> {
        if (!challengeId || challengeId.trim() === "") {
            throw new InvalidChallengeError("Challenge ID must not be empty");
        }

        const record = this.challenges.get(challengeId.trim());
        if (!record) {
            throw new InvalidChallengeError(
                `Challenge not found: ${challengeId}`,
            );
        }

        // Controllo anti-replay: la challenge non deve essere già stata usata
        if (record.used) {
            throw new ReplayedChallengeError(
                `Challenge has already been used: ${challengeId}`,
            );
        }

        // Controllo che appartenga al lavoratore che la sta presentando
        if (expectedWorkerId !== undefined) {
            if (record.workerId !== expectedWorkerId.trim()) {
                throw new InvalidChallengeError(
                    `Challenge does not belong to worker: ${expectedWorkerId}`,
                );
            }
        }

        // Controllo che si riferisca alla patente corretta
        if (expectedLicenseRef !== undefined) {
            if (record.licenseRef !== expectedLicenseRef.trim()) {
                throw new InvalidChallengeError(
                    `Challenge was not issued for license: ${expectedLicenseRef}`,
                );
            }
        }

        // Controllo che il valore numerico coincida con quello usato nella prova
        if (expectedValue !== undefined) {
            if (record.challenge !== expectedValue.trim()) {
                throw new InvalidChallengeError(
                    "Challenge value does not match expected challenge",
                );
            }
        }

        return { ...record };
    }

    async consumeChallenge(challengeId: string): Promise<void> {
        if (!challengeId || challengeId.trim() === "") {
            throw new InvalidChallengeError("Challenge ID must not be empty");
        }

        const record = this.challenges.get(challengeId.trim());
        if (!record) {
            throw new InvalidChallengeError(
                `Challenge not found: ${challengeId}`,
            );
        }

        if (record.used) {
            throw new ReplayedChallengeError(
                `Challenge has already been used: ${challengeId}`,
            );
        }

        // Segna come utilizzata
        record.used = true;

        // Rimuove dai riferimenti attivi del lavoratore
        if (this.workerActiveChallenge.get(record.workerId) === record.id) {
            this.workerActiveChallenge.delete(record.workerId);
        }
    }
}
