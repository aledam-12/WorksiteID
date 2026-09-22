/**
 * @file commitment.service.ts
 * @description Servizio per il calcolo crittografico dei commitment dello stato della patente.
 * Utilizza la funzione hash algebrica Poseidon (SNARK-friendly) e randomness CSPRNG
 * garantendo le proprietà di Hiding (riservatezza crediti) e Binding (immodificabilità).
 *
 * @dependencies
 * - circomlibjs: implementazione della funzione hash Poseidon.
 * - node:crypto: generazione di randomness crittograficamente sicura (CSPRNG) e timingSafeEqual.
 * - domain/license.js: enumerazione LicenseStatusEnum.
 */

import { randomBytes, timingSafeEqual } from "node:crypto";
import { buildPoseidon, PoseidonFunction } from "circomlibjs";
import { LicenseStatusEnum } from "../../domain/license.js";

/**
 * Stato della patente da inserire nel commitment crittografico.
 */
export type CommitmentState = Record<string, unknown>;

/** Istanza singleton della funzione Poseidon */
let poseidonPromise: Promise<PoseidonFunction> | null = null;

/**
 * Recupera o inizializza l'istanza singleton della funzione hash Poseidon da circomlibjs.
 */
export async function getPoseidonInstance(): Promise<PoseidonFunction> {
    if (!poseidonPromise) {
        poseidonPromise = buildPoseidon();
    }
    return poseidonPromise;
}

/**
 * Converte qualsiasi tipo di valore di input (bigint, intero o stringa numerica/hex)
 * in un BigInt compatibile con il campo finito del circuito Circom.
 * @throws {Error} Se il valore non è un intero valido
 */
export function parseFieldElement(val: unknown): bigint {
    if (typeof val === "bigint") return val;
    if (typeof val === "number") {
        if (!Number.isFinite(val) || !Number.isInteger(val)) {
            throw new Error(`Invalid number for field element: ${val}`);
        }
        return BigInt(val);
    }
    if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed === "") {
            throw new Error("Cannot convert empty string to field element");
        }
        if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
            return BigInt(trimmed);
        }
        if (/^[0-9]+$/.test(trimmed)) {
            return BigInt(trimmed);
        }
        if (/^[0-9a-fA-F]+$/.test(trimmed)) {
            return BigInt("0x" + trimmed);
        }
    }
    throw new Error(`Cannot convert value to field element: ${String(val)}`);
}

/**
 * Contratto per il servizio di calcolo e verifica dei commitment Poseidon.
 */
export interface CommitmentService {
    /**
     * Genera una stringa decimale casuale CSPRNG da usare come randomness dello stato.
     * @param byteLength Lunghezza in byte (default 31 byte)
     */
    generateRandomness(byteLength?: number): string;

    /**
     * Calcola il commitment Poseidon: C = Poseidon([credits, status, version, randomness]).
     * @param state Oggetto contenente credits, status, version
     * @param randomness Segreto di randomness
     */
    createCommitment(state: CommitmentState, randomness: string): Promise<string>;

    /**
     * Confronta a tempo costante il commitment ricalcolato con quello atteso.
     * @param state Stato privato
     * @param randomness Randomness segreta
     * @param commitment Commitment registrato on-chain
     */
    verifyCommitment(
        state: CommitmentState,
        randomness: string,
        commitment: string,
    ): Promise<boolean>;
}

/**
 * Implementazione concreta di CommitmentService basata su Poseidon hash di Circom.
 */
export class CommitmentServiceImpl implements CommitmentService {
    /**
     * Genera un numero casuale a 31 byte crittograficamente sicuro (CSPRNG).
     */
    generateRandomness(byteLength: number = 31): string {
        if (!Number.isInteger(byteLength) || byteLength <= 0) {
            throw new Error("Byte length must be a positive integer");
        }
        const bytes = randomBytes(byteLength);
        return BigInt("0x" + bytes.toString("hex")).toString();
    }

    /**
     * Calcola il commitment Poseidon a 4 elementi: credits, status, version, randomness.
     */
    async createCommitment(
        state: CommitmentState,
        randomness: string,
    ): Promise<string> {
        if (!state || typeof state !== "object" || Array.isArray(state)) {
            throw new Error("State must be a non-null object");
        }

        if (
            !randomness ||
            typeof randomness !== "string" ||
            randomness.trim() === ""
        ) {
            throw new Error("Randomness must not be empty");
        }

        const credits = state.credits;
        if (credits === undefined || credits === null) {
            throw new Error("State must include credits");
        }
        const creditsBigInt = parseFieldElement(credits);

        const status = state.status;
        if (status === undefined || status === null) {
            throw new Error("State must include status");
        }
        let statusBigInt: bigint;
        if (status === LicenseStatusEnum.ACTIVE || status === "ACTIVE") {
            statusBigInt = 1n;
        } else if (status === LicenseStatusEnum.REVOKED || status === "REVOKED") {
            statusBigInt = 0n;
        } else {
            statusBigInt = parseFieldElement(status);
        }

        const version = state.version;
        if (version === undefined || version === null) {
            throw new Error("State must include version");
        }
        const versionBigInt = parseFieldElement(version);

        const randomnessBigInt = parseFieldElement(randomness);

        const poseidon = await getPoseidonInstance();
        const hash = poseidon([
            creditsBigInt,
            statusBigInt,
            versionBigInt,
            randomnessBigInt,
        ]);

        return poseidon.F.toString(hash);
    }

    /**
     * Verifica il commitment prevenendo attacchi di temporizzazione (timing attacks).
     */
    async verifyCommitment(
        state: CommitmentState,
        randomness: string,
        commitment: string,
    ): Promise<boolean> {
        if (
            !commitment ||
            typeof commitment !== "string" ||
            commitment.trim() === ""
        ) {
            return false;
        }

        try {
            const expectedCommitment = await this.createCommitment(state, randomness);
            const normalizedActual = commitment.trim();

            if (expectedCommitment.length !== normalizedActual.length) {
                return false;
            }

            const expectedBuffer = Buffer.from(expectedCommitment, "utf8");
            const actualBuffer = Buffer.from(normalizedActual, "utf8");

            return timingSafeEqual(expectedBuffer, actualBuffer);
        } catch {
            return false;
        }
    }
}
