/**
 * @file challenge.service.ts
 * @description Servizio per la generazione e validazione di challenge crittografiche monouso (anti-replay).
 * Previene il riutilizzo di prove a conoscenza zero (ZKP) legando ogni verifica a un nonce casuale univoco.
 *
 * @dependencies
 * - node:crypto: generazione di byte casuali crittografici (randomBytes) e UUID (randomUUID).
 * - domain/zkp-errors.js: eccezioni tipizzate (InvalidChallengeError, ReplayedChallengeError).
 */

import { randomBytes, randomUUID } from "node:crypto";
import {
    InvalidChallengeError,
    ReplayedChallengeError,
} from "../../domain/zkp-errors.js";

/**
 * Rappresenta la sfida (challenge) temporanea generata dal server per la verifica d'accesso.
 */
export interface VerificationChallenge {
    /** Identificativo univoco della sessione di sfida (UUID v4) */
    id: string;
    /** Valore numerico della sfida (in campo scalare BN254) convertito in stringa */
    challenge: string;
    /** ID del lavoratore a cui è associata la sfida */
    workerId: string;
    /** Identificativo pseudonimo della patente (licenseRef) */
    licenseRef: string;
    /** Flag che indica se la sfida è già stata consumata (prevenzione replay) */
    used: boolean;
}

/**
 * Contratto per la gestione del ciclo di vita delle challenge anti-replay.
 */
export interface ChallengeService {
    /**
     * Genera una nuova challenge casuale a 31 byte per una coppia lavoratore/patente.
     * Invalida eventuali sfide precedenti ancora attive per lo stesso lavoratore.
     *
     * @param workerId Identificativo del lavoratore
     * @param licenseRef Riferimento pseudonimo della patente
     * @returns La challenge generata
     */
    createChallenge(
        workerId: string,
        licenseRef: string,
    ): Promise<VerificationChallenge>;

    /**
     * Recupera una challenge dato il suo ID univoco.
     *
     * @param challengeId Identificativo della challenge
     * @returns La challenge trovata o null
     */
    getChallenge(challengeId: string): Promise<VerificationChallenge | null>;

    /**
     * Valida la validità della challenge e ne verifica la corrispondenza con i parametri attesi.
     *
     * @param challengeId Identificativo della challenge da validare
     * @param expectedWorkerId ID lavoratore atteso (opzionale)
     * @param expectedLicenseRef Riferimento patente atteso (opzionale)
     * @param expectedValue Valore numerico atteso della challenge (opzionale)
     * @returns La challenge validata
     * @throws {InvalidChallengeError} Se la challenge non esiste o i parametri non corrispondono
     * @throws {ReplayedChallengeError} Se la challenge è già stata utilizzata
     */
    validateChallenge(
        challengeId: string,
        expectedWorkerId?: string,
        expectedLicenseRef?: string,
        expectedValue?: string,
    ): Promise<VerificationChallenge>;

    /**
     * Marca la challenge come utilizzata per impedirne il riutilizzo in attacchi replay.
     *
     * @param challengeId Identificativo della challenge da consumare
     * @throws {InvalidChallengeError} Se la challenge non esiste o l'ID è vuoto
     * @throws {ReplayedChallengeError} Se la challenge è già stata consumata
     */
    consumeChallenge(challengeId: string): Promise<void>;
}

/**
 * Implementazione in-memory del servizio di challenge anti-replay.
 */
export class ChallengeServiceImpl implements ChallengeService {
    private readonly challenges: Map<string, VerificationChallenge> = new Map();
    private readonly workerActiveChallenge: Map<string, string> = new Map();

    /**
     * Crea e registra una nuova sfida casuale a 31 byte in formato scalare compatibile con Circom.
     * Se esiste già una sfida attiva per il lavoratore, la rimuove per evitare duplicati.
     *
     * @param workerId Identificativo del lavoratore
     * @param licenseRef Riferimento pseudonimo della patente
     * @returns La sfida appena creata
     */
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

        const existingChallengeId = this.workerActiveChallenge.get(normalizedWorkerId);
        if (existingChallengeId) {
            this.challenges.delete(existingChallengeId);
            this.workerActiveChallenge.delete(normalizedWorkerId);
        }

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

    /**
     * Recupera una copia della sfida memorizzata tramite ID.
     *
     * @param challengeId Identificativo della sfida
     * @returns La sfida trovata oppure null
     */
    async getChallenge(
        challengeId: string,
    ): Promise<VerificationChallenge | null> {
        if (!challengeId || challengeId.trim() === "") {
            return null;
        }
        const record = this.challenges.get(challengeId.trim());
        return record ? { ...record } : null;
    }

    /**
     * Verifica l'esistenza, l'integrità e lo stato di consumo di una sfida.
     *
     * @param challengeId Identificativo della sfida
     * @param expectedWorkerId Lavoratore atteso
     * @param expectedLicenseRef Patente attesa
     * @param expectedValue Valore numerico atteso
     * @returns La sfida validata
     */
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

        if (record.used) {
            throw new ReplayedChallengeError(
                `Challenge has already been used: ${challengeId}`,
            );
        }

        if (expectedWorkerId !== undefined) {
            if (record.workerId !== expectedWorkerId.trim()) {
                throw new InvalidChallengeError(
                    `Challenge does not belong to worker: ${expectedWorkerId}`,
                );
            }
        }

        if (expectedLicenseRef !== undefined) {
            if (record.licenseRef !== expectedLicenseRef.trim()) {
                throw new InvalidChallengeError(
                    `Challenge was not issued for license: ${expectedLicenseRef}`,
                );
            }
        }

        if (expectedValue !== undefined) {
            if (record.challenge !== expectedValue.trim()) {
                throw new InvalidChallengeError(
                    "Challenge value does not match expected challenge",
                );
            }
        }

        return { ...record };
    }

    /**
     * Invalida la sfida impostando used = true e rimuovendola dalle sfide attive del lavoratore.
     *
     * @param challengeId Identificativo della sfida da consumare
     */
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

        record.used = true;

        if (this.workerActiveChallenge.get(record.workerId) === record.id) {
            this.workerActiveChallenge.delete(record.workerId);
        }
    }
}
