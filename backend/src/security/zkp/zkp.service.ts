/**
 * @file zkp.service.ts
 * @description Servizio per la generazione e verifica di prove crittografiche a conoscenza zero (ZKP) mediante Groth16 su curve BN254.
 * Interagisce con i file compilati Circom (WASM, zkey, vkey) e SnarkJS per dimostrare la validità della patente senza svelarne i crediti.
 *
 * @dependencies
 * - snarkjs: motore crittografico Groth16 (fullProve e verify).
 * - node:fs / node:fs/promises: caricamento e caching della chiave di verifica (vkey.json).
 * - domain/zkp.js: tipi di prova Groth16Proof, LicenseZkpWitness e parser segnali pubblici.
 * - domain/zkp-errors.js: errore di configurazione ZkpConfigError.
 * - domain/license.js: enumerazione LicenseStatusEnum.
 * - commitment.service.js: funzione hash Poseidon e parsing in campo scalare.
 * - config/index.js: percorsi predefiniti degli artefatti Circom.
 */

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { groth16 } from "snarkjs";
import {
    type Groth16Proof,
    type LicenseZkpWitness,
    parsePublicSignals,
    type ZkpPublicSignals,
} from "../../domain/zkp.js";
import { ZkpConfigError } from "../../domain/zkp-errors.js";
import {
    getPoseidonInstance,
    parseFieldElement,
} from "./commitment.service.js";
import { envConfig } from "../../config/index.js";
import { LicenseStatusEnum } from "../../domain/license.js";

/**
 * Percorsi nel filesystem degli artefatti compilati del circuito ZKP.
 */
export interface ZkpConfig {
    /** Percorso al file bytecode WebAssembly del circuito Circom (*.wasm) */
    wasmPath: string;
    /** Percorso alla chiave di prova Groth16 (*.zkey) */
    zkeyPath: string;
    /** Percorso al file JSON della chiave pubblica di verifica (verification_key.json) */
    verificationKeyPath: string;
}

/**
 * Contratto per la generazione e la verifica di prove Groth16 legate alla patente.
 */
export interface ZkpService {
    /**
     * Calcola il commitment Poseidon(credits, status, version, randomness).
     *
     * @param credits Saldo crediti della patente
     * @param status Stato della patente (ACTIVE/REVOKED o numerico)
     * @param version Versione progressiva dello stato
     * @param randomness Valore di blinding casuale CSPRNG
     * @returns Stringa scalare del commitment calcolato
     */
    computeCommitment(
        credits: number,
        status: number | LicenseStatusEnum | string,
        version: number,
        randomness: string,
    ): Promise<string>;

    /**
     * Calcola il vincolo crittografico challengeBinding = Poseidon(commitment, challenge, randomness).
     *
     * @param commitment Commitment dello stato della patente
     * @param challenge Sfida anti-replay ricevuta dal gate
     * @param randomness Valore di blinding casuale
     * @returns Stringa scalare del challengeBinding calcolato
     */
    computeChallengeBinding(
        commitment: string,
        challenge: string,
        randomness: string,
    ): Promise<string>;

    /**
     * Genera la prova crittografica Groth16 eseguendo il circuito Circom con il witness privato.
     *
     * @param witness Dati privati della patente (crediti, stato, versione, randomness)
     * @param challenge Sfida anti-replay pubblica
     * @returns Oggetto contenente la prova crittografica e la tupla dei segnali pubblici
     */
    generateProof(
        witness: LicenseZkpWitness,
        challenge: string,
    ): Promise<{ proof: Groth16Proof; publicSignals: [string, string, string] }>;

    /**
     * Valida matematicamente una prova Groth16 contro i segnali pubblici e la chiave di verifica.
     *
     * @param proof Prova Groth16 fornita dal prover (lavoratore)
     * @param publicSignals Segnali pubblici [commitment, challenge, challengeBinding]
     * @returns true se la dimostrazione matematica è valida, false altrimenti
     */
    verifyProof(
        proof: Groth16Proof,
        publicSignals: [string, string, string] | ZkpPublicSignals | string[],
    ): Promise<boolean>;
}

/**
 * Normalizza lo stato della patente in un elemento del campo scalare BigInt (1 per ACTIVE, 0 per REVOKED).
 *
 * @param status Stato espresso come stringa o enumerazione
 * @returns Elemento scalare BigInt (1n o 0n)
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

/**
 * Implementazione del servizio ZKP basata su SnarkJS e Groth16.
 */
export class ZkpServiceImpl implements ZkpService {
    private readonly config: ZkpConfig;
    private vKeyCache: Record<string, unknown> | null = null;

    /**
     * Inizializza il servizio configurando i percorsi degli artefatti del circuito Circom.
     * @param customConfig Configurazione opzionale personalizzata dei percorsi
     */
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
     * Calcola il commitment crittografico Poseidon dei 4 campi di stato della patente.
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
     * Calcola il vincolo challengeBinding Poseidon(commitment, challenge, randomness).
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
     * Genera la prova a conoscenza zero Groth16 e i relativi segnali pubblici.
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
     * Verifica la prova Groth16 confrontandola con la chiave pubblica di verifica.
     */
    async verifyProof(
        proof: Groth16Proof,
        publicSignals: [string, string, string] | ZkpPublicSignals | string[],
    ): Promise<boolean> {
        if (!proof || typeof proof !== "object") {
            return false;
        }

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
     * Carica in cache il file JSON contenente la chiave di verifica del circuito.
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
     * Controlla l'esistenza del file indicato sul filesystem, sollevando eccezione in caso negativo.
     */
    #ensureFileExists(filePath: string, description: string): void {
        if (!existsSync(filePath)) {
            throw new ZkpConfigError(
                `${description} not found at path: ${filePath}`,
            );
        }
    }
}
