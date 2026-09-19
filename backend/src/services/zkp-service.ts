import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { groth16 } from "snarkjs";
import {
    Groth16Proof,
    LicenseZkpWitness,
    parsePublicSignals,
    ZkpPublicSignals,
} from "../domain/zkp.js";
import { ZkpConfigError } from "../domain/zkp-errors.js";
import {
    getPoseidonInstance,
    parseFieldElement,
} from "./commitment-service.js";
import { envConfig } from "../config/index.js";
import { LicenseStatusEnum } from "../domain/license.js";

/**
 * Percorsi dei file necessari per generare e verificare la prova ZKP.
 */
export interface ZkpConfig {
    /** File WASM compilato da Circom (calcola il witness e controlla i vincoli) */
    wasmPath: string;
    /** File zkey contenente la chiave di prova */
    zkeyPath: string;
    /** File JSON contenente la chiave pubblica di verifica */
    verificationKeyPath: string;
}

/**
 * Servizio per la gestione delle prove ZKP (Zero-Knowledge Proof) con SnarkJS e Groth16.
 */
export interface ZkpService {
    /**
     * Calcola il commitment Poseidon dello stato della patente:
     * C = Poseidon([credits, status, version, randomness])
     */
    computeCommitment(
        credits: number,
        status: number | LicenseStatusEnum | string,
        version: number,
        randomness: string,
    ): Promise<string>;

    /**
     * Calcola il collegamento tra commitment, challenge e randomness del lavoratore:
     * CB = Poseidon([commitment, challenge, randomness])
     */
    computeChallengeBinding(
        commitment: string,
        challenge: string,
        randomness: string,
    ): Promise<string>;

    /**
     * Genera la prova a conoscenza zero Groth16 e i relativi segnali pubblici.
     */
    generateProof(
        witness: LicenseZkpWitness,
        challenge: string,
    ): Promise<{ proof: Groth16Proof; publicSignals: [string, string, string] }>;

    /**
     * Verifica la validità della prova Groth16.
     */
    verifyProof(
        proof: Groth16Proof,
        publicSignals: [string, string, string] | ZkpPublicSignals | string[],
    ): Promise<boolean>;
}

/**
 * Converte lo stato della patente in valore numerico (1 per ACTIVE, 0 per REVOKED).
 */
function parseStatusToField(status: number | LicenseStatusEnum | string): bigint {
    if (
        status === LicenseStatusEnum.ACTIVE ||
        status === "ACTIVE" ||
        status === 1 ||
        status === "1"
    ) {
        return 1n;
    }
    if (
        status === LicenseStatusEnum.REVOKED ||
        status === "REVOKED" ||
        status === 0 ||
        status === "0"
    ) {
        return 0n;
    }
    return parseFieldElement(status);
}

export class ZkpServiceImpl implements ZkpService {
    private readonly config: ZkpConfig;
    private vKeyCache: Record<string, unknown> | null = null;

    constructor(customConfig?: Partial<ZkpConfig>) {
        this.config = {
            wasmPath: customConfig?.wasmPath ?? envConfig.zkpWasmPath,
            zkeyPath: customConfig?.zkeyPath ?? envConfig.zkpZkeyPath,
            verificationKeyPath:
                customConfig?.verificationKeyPath ??
                envConfig.zkpVerificationKeyPath,
        };
    }

    /**
     * Calcola l'hash Poseidon dello stato della patente a 4 input.
     * Corrisponde esattamente al componente Poseidon(4) nel circuito Circom.
     *
     * @param credits Saldo crediti della patente
     * @param status Stato (ACTIVE = 1, REVOKED = 0)
     * @param version Versione sequenziale della patente
     * @param randomness Valore segreto casuale
     * @returns Il commitment come stringa numerica
     */
    async computeCommitment(
        credits: number,
        status: number | LicenseStatusEnum | string,
        version: number,
        randomness: string,
    ): Promise<string> {
        const poseidon = await getPoseidonInstance();

        const creditsBigInt = parseFieldElement(credits);
        const statusBigInt = parseStatusToField(status);
        const versionBigInt = parseFieldElement(version);
        const randBigInt = parseFieldElement(randomness);

        const hash = poseidon([
            creditsBigInt,
            statusBigInt,
            versionBigInt,
            randBigInt,
        ]);

        return poseidon.F.toString(hash);
    }

    /**
     * Calcola l'hash Poseidon a 3 input per legare la challenge al commitment.
     * Serve a dimostrare che chi crea la prova possiede la randomness giusta per questa challenge,
     * senza dover rivelare la randomness in chiaro.
     *
     * @param commitment Commitment della patente
     * @param challenge Sfida casuale della sessione
     * @param randomness Segreto del lavoratore
     * @returns Il digest del binding come stringa numerica
     */
    async computeChallengeBinding(
        commitment: string,
        challenge: string,
        randomness: string,
    ): Promise<string> {
        const poseidon = await getPoseidonInstance();

        const commitmentBigInt = parseFieldElement(commitment);
        const challengeBigInt = parseFieldElement(challenge);
        const randBigInt = parseFieldElement(randomness);

        const hash = poseidon([
            commitmentBigInt,
            challengeBigInt,
            randBigInt,
        ]);

        return poseidon.F.toString(hash);
    }

    /**
     * Genera la prova a conoscenza zero Groth16.
     *
     * Passaggi:
     * 1. Calcola commitment e challengeBinding attesi.
     * 2. Costruisce gli input per il circuito (dati privati e pubblici).
     * 3. Invoca groth16.fullProve di SnarkJS:
     *    - il file WASM calcola il witness e controlla i vincoli (es. crediti >= 15 e stato attivo);
     *    - il file .zkey calcola la prova Groth16.
     *
     * @param witness Dati privati della patente
     * @param challenge Sfida casuale monouso
     * @returns Oggetto con la prova e i segnali pubblici
     */
    async generateProof(
        witness: LicenseZkpWitness,
        challenge: string,
    ): Promise<{ proof: Groth16Proof; publicSignals: [string, string, string] }> {
        if (!witness || typeof witness !== "object") {
            throw new Error("Witness must be a valid object");
        }
        if (!challenge || String(challenge).trim() === "") {
            throw new Error("Challenge must not be empty");
        }

        // Calcolo dei valori attesi con Poseidon
        const commitment = await this.computeCommitment(
            witness.credits,
            witness.status,
            witness.version,
            witness.randomness,
        );

        const challengeBinding = await this.computeChallengeBinding(
            commitment,
            challenge,
            witness.randomness,
        );

        const statusBigInt = parseStatusToField(witness.status);

        // Input completi per il circuito Circom
        const circuitInput = {
            credits: String(witness.credits),
            status: statusBigInt.toString(),
            version: String(witness.version),
            randomness: parseFieldElement(witness.randomness).toString(),
            commitment: commitment,
            challenge: parseFieldElement(challenge).toString(),
            challengeBinding: challengeBinding,
        };

        this.#ensureFileExists(this.config.wasmPath, "WASM circuit file");
        this.#ensureFileExists(this.config.zkeyPath, "ZKey proving file");

        // Generazione della prova con SnarkJS
        const { proof, publicSignals } = await groth16.fullProve(
            circuitInput,
            this.config.wasmPath,
            this.config.zkeyPath,
        );

        return {
            proof: proof as Groth16Proof,
            publicSignals: [
                String(publicSignals[0]),
                String(publicSignals[1]),
                String(publicSignals[2]),
            ],
        };
    }

    /**
     * Verifica la validità di una prova Groth16.
     *
     * Non servono i dati privati né il file .zkey: bastano solo la chiave
     * di verifica pubblica (verification_key.json) e i segnali pubblici.
     * L'operazione viene eseguita da SnarkJS in pochi millisecondi.
     *
     * @param proof La prova Groth16 ricevuta
     * @param publicSignals I segnali pubblici della prova
     * @returns true se la prova è valida, false altrimenti
     */
    async verifyProof(
        proof: Groth16Proof,
        publicSignals: [string, string, string] | ZkpPublicSignals | string[],
    ): Promise<boolean> {
        if (!proof || typeof proof !== "object") {
            return false;
        }

        // Normalizza i segnali pubblici in array [commitment, challenge, challengeBinding]
        let signalsArray: string[];
        if (Array.isArray(publicSignals)) {
            if (publicSignals.length < 3) {
                return false;
            }
            signalsArray = [
                String(publicSignals[0]).trim(),
                String(publicSignals[1]).trim(),
                String(publicSignals[2]).trim(),
            ];
        } else {
            try {
                const parsed = parsePublicSignals(publicSignals);
                signalsArray = [
                    parsed.commitment,
                    parsed.challenge,
                    parsed.challengeBinding,
                ];
            } catch {
                return false;
            }
        }

        try {
            const vKey = await this.#loadVerificationKey();
            return await groth16.verify(vKey, signalsArray, proof);
        } catch {
            return false;
        }
    }

    /**
     * Carica in memoria la chiave di verifica dal file JSON per non rileggerla ogni volta dal disco.
     */
    async #loadVerificationKey(): Promise<Record<string, unknown>> {
        if (!this.vKeyCache) {
            this.#ensureFileExists(
                this.config.verificationKeyPath,
                "Verification key file",
            );
            const content = await readFile(
                this.config.verificationKeyPath,
                "utf8",
            );
            this.vKeyCache = JSON.parse(content) as Record<string, unknown>;
        }
        return this.vKeyCache;
    }

    /**
     * Controlla che il file richiesto esista sul disco.
     */
    #ensureFileExists(filePath: string, description: string): void {
        if (!existsSync(filePath)) {
            throw new ZkpConfigError(
                `${description} not found at path: ${filePath}`,
            );
        }
    }
}
