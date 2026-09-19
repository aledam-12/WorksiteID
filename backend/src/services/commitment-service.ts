import { randomBytes, timingSafeEqual } from "node:crypto";
import { buildPoseidon, PoseidonFunction } from "circomlibjs";
import { LicenseStatusEnum } from "../domain/license.js";

/**
 * Stato della patente da inserire nel commitment crittografico.
 */
export type CommitmentState = Record<string, unknown>;

/** Istanza singleton della funzione Poseidon */
let poseidonPromise: Promise<PoseidonFunction> | null = null;

/**
 * Recupera o inizializza l'istanza della funzione hash Poseidon da circomlibjs.
 *
 * @returns Istanza PoseidonFunction pronta all'uso
 */
export async function getPoseidonInstance(): Promise<PoseidonFunction> {
    if (!poseidonPromise) {
        poseidonPromise = buildPoseidon();
    }
    return poseidonPromise;
}

/**
 * Converte qualsiasi tipo di valore di input (bigint, intero o stringa numerica)
 * in un BigInt compatibile con il circuito.
 *
 * @param val Valore da convertire
 * @returns Valore convertito in BigInt
 * @throws Error se il valore non è valido
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
 * Servizio per il calcolo e la verifica dei commitment Poseidon della patente.
 * Proprietà fondamentali:
 * - Hiding: nasconde i crediti e lo stato della patente grazie alla randomness casuale.
 * - Binding: impedisce di modificare i dati della patente dopo aver registrato il commitment on-chain.
 */
export interface CommitmentService {
    /**
     * Genera una stringa casuale crittograficamente sicura (CSPRNG) da usare come randomness.
     *
     * @param byteLength Numero di byte casuali (default 31 byte)
     * @returns Valore casuale come stringa decimale
     */
    generateRandomness(byteLength?: number): string;

    /**
     * Calcola il commitment Poseidon dello stato della patente:
     * C = Poseidon([credits, status, version, randomness])
     *
     * @param state Oggetto contenente credits, status, version
     * @param randomness Valore segreto di randomness
     * @returns Stringa decimale del commitment compatibile con il circuito Circom
     */
    createCommitment(state: CommitmentState, randomness: string): Promise<string>;

    /**
     * Verifica a tempo costante se il commitment corrisponde allo stato e alla randomness forniti.
     *
     * @param state Oggetto contenente credits, status, version
     * @param randomness Segreto del commitment
     * @param commitment Commitment atteso
     * @returns true se il commitment corrisponde, false altrimenti
     */
    verifyCommitment(
        state: CommitmentState,
        randomness: string,
        commitment: string,
    ): Promise<boolean>;
}

export class CommitmentServiceImpl implements CommitmentService {
    /**
     * Genera un numero casuale a 31 byte tramite crypto.randomBytes.
     */
    generateRandomness(byteLength: number = 31): string {
        if (!Number.isInteger(byteLength) || byteLength <= 0) {
            throw new Error("Byte length must be a positive integer");
        }
        const bytes = randomBytes(byteLength);
        return BigInt("0x" + bytes.toString("hex")).toString();
    }

    /**
     * Calcola il commitment Poseidon a 4 input:
     * Poseidon([credits, status, version, randomness])
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

        // 1. Estrazione dei crediti
        const credits = state.credits;
        if (credits === undefined || credits === null) {
            throw new Error("State must include credits");
        }
        const creditsBigInt = parseFieldElement(credits);

        // 2. Normalizzazione dello stato (1 per ACTIVE, 0 per REVOKED)
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

        // 3. Estrazione della versione
        const version = state.version;
        if (version === undefined || version === null) {
            throw new Error("State must include version");
        }
        const versionBigInt = parseFieldElement(version);

        // 4. Parsing della randomness
        const randomnessBigInt = parseFieldElement(randomness);

        // 5. Calcolo dell'hash Poseidon
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
     * Confronta a tempo costante il commitment calcolato con quello fornito,
     * prevenendo attacchi di temporizzazione (timing attacks).
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
