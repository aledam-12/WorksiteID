/**
 * @file vc-issuer.service.ts
 * @description Servizio per l'emissione di Verifiable Credentials conformi allo standard W3C per le patenti di cantiere.
 * Applica canonicizzazione deterministica del payload JSON e genera firme digitali asimmetriche con algoritmo Ed25519.
 *
 * @dependencies
 * - node:crypto: gestione chiavi Ed25519 (KeyObject), generazione firme digitali e UUID.
 * - node:fs: caricamento opzionale dei certificati e delle chiavi PEM da filesystem.
 * - repositories/worker-repository.js: verifica dell'esistenza anagrafica del lavoratore.
 * - repositories/license-repository.js: autorizzazione lavoratore-patente.
 * - domain/verifiable-credential.js: costanti W3C, canonicizzazione payload e schema VC.
 * - config/index.js: configurazione delle chiavi e degli identificativi issuer.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import { type WorkerRepository } from "../../repositories/worker-repository.js";
import { type LicenseRepository } from "../../repositories/license-repository.js";
import {
    canonicalizeCredentialPayload,
    DEFAULT_CREDENTIAL_TYPE,
    DEFAULT_PROOF_PURPOSE,
    DEFAULT_PROOF_TYPE,
    type WorksiteLicenseCredential,
} from "../../domain/verifiable-credential.js";
import { envConfig } from "../../config/index.js";

/**
 * Parametri di configurazione crittografica per l'Issuer di Verifiable Credentials.
 */
export interface CredentialIssuerConfig {
    /** DID o URI univoco dell'Issuer (es. "did:worksiteid:issuer" o "worksiteid-issuer") */
    issuerId?: string;
    /** Identificativo del metodo di verifica (es. "<issuerId>#key-1") */
    verificationMethod?: string;
    /** Chiave privata dell'issuer in formato PEM */
    privateKeyPem?: string;
    /** Chiave pubblica corrispondente in formato PEM */
    publicKeyPem?: string;
    /** Percorso su filesystem alla chiave privata */
    privateKeyPath?: string;
    /** Percorso su filesystem alla chiave pubblica */
    publicKeyPath?: string;
}

/**
 * Contratto per l'emissione e la gestione delle chiavi dell'Issuer di credenziali verificabili.
 */
export interface CredentialIssuerService {
    /**
     * Emette una nuova Verifiable Credential W3C firmata con Ed25519 per un lavoratore autorizzato.
     *
     * @param authenticatedWorkerId ID del lavoratore autenticato richiedente
     * @param licenseRef Riferimento pseudonimo della patente da associare
     * @returns La credenziale verificabile firmata
     */
    issueLicenseCredential(
        authenticatedWorkerId: string,
        licenseRef: string,
    ): Promise<WorksiteLicenseCredential>;

    /**
     * Restituisce la chiave pubblica dell'Issuer serializzata in formato SPKI PEM.
     */
    getPublicKeyPem(): string;

    /**
     * Restituisce l'identificativo DID o URI dell'Issuer.
     */
    getIssuerId(): string;

    /**
     * Restituisce l'URI del metodo di verifica (verificationMethod) inserito nella proof W3C.
     */
    getVerificationMethod(): string;
}

/**
 * Implementazione concreta del servizio Issuer W3C con supporto crittografico Ed25519.
 */
export class CredentialIssuerServiceImpl implements CredentialIssuerService {
    private readonly issuerId: string;
    private readonly verificationMethod: string;
    private readonly privateKey: crypto.KeyObject;
    private readonly publicKey: crypto.KeyObject;

    /**
     * Inizializza l'Issuer caricando le chiavi Ed25519 fornite o generando una coppia temporanea in dev/test.
     *
     * @param workerRepository Repository anagrafica lavoratori
     * @param config Configurazione opzionale di chiavi e identificativi
     * @param licenseRepository Repository opzionale per la verifica di associazione patente-lavoratore
     */
    constructor(
        private readonly workerRepository: WorkerRepository,
        config: CredentialIssuerConfig = {},
        private readonly licenseRepository?: LicenseRepository,
    ) {
        this.issuerId = config.issuerId?.trim() || envConfig.vcIssuerId || envConfig.fireflyIssuerId || "worksiteid-issuer";
        this.verificationMethod =
            config.verificationMethod?.trim() || `${this.issuerId}#key-1`;

        let privateKeyPem = config.privateKeyPem;
        let publicKeyPem = config.publicKeyPem;

        if (!privateKeyPem) {
            const keyPath = config.privateKeyPath ?? envConfig.issuerPrivateKeyPath;
            if (keyPath) {
                if (!fs.existsSync(keyPath)) {
                    throw new Error(`Issuer private key file not found: ${keyPath}`);
                }
                privateKeyPem = fs.readFileSync(keyPath, "utf-8");
            } else if (envConfig.issuerPrivateKeyPem) {
                privateKeyPem = envConfig.issuerPrivateKeyPem;
            }
        }

        if (!publicKeyPem) {
            const pubPath = config.publicKeyPath ?? envConfig.issuerPublicKeyPath;
            if (pubPath) {
                if (!fs.existsSync(pubPath)) {
                    throw new Error(`Issuer public key file not found: ${pubPath}`);
                }
                publicKeyPem = fs.readFileSync(pubPath, "utf-8");
            } else if (envConfig.issuerPublicKeyPem) {
                publicKeyPem = envConfig.issuerPublicKeyPem;
            }
        }

        if (privateKeyPem) {
            this.privateKey = crypto.createPrivateKey(privateKeyPem);
            const derivedPublicKey = crypto.createPublicKey(this.privateKey);
            if (publicKeyPem) {
                const configuredPublicKey = crypto.createPublicKey(publicKeyPem);
                const derivedPem = derivedPublicKey.export({ type: "spki", format: "pem" }) as string;
                const configuredPem = configuredPublicKey.export({ type: "spki", format: "pem" }) as string;
                if (derivedPem.trim() !== configuredPem.trim()) {
                    throw new Error("Issuer public key does not match the private key");
                }
                this.publicKey = configuredPublicKey;
            } else {
                this.publicKey = derivedPublicKey;
            }
        } else {
            if (envConfig.nodeEnv === "production") {
                throw new Error(
                    "Issuer private key is required in production environment (set VC_ISSUER_PRIVATE_KEY_PATH, ISSUER_PRIVATE_KEY_PATH or ISSUER_PRIVATE_KEY_PEM)",
                );
            }
            const keyPair = crypto.generateKeyPairSync("ed25519");
            this.privateKey = keyPair.privateKey;
            this.publicKey = keyPair.publicKey;
        }
    }

    /**
     * Restituisce l'identificativo dell'issuer.
     */
    getIssuerId(): string {
        return this.issuerId;
    }

    /**
     * Restituisce il metodo di verifica registrato.
     */
    getVerificationMethod(): string {
        return this.verificationMethod;
    }

    /**
     * Esporta la chiave pubblica in formato PEM SPKI.
     */
    getPublicKeyPem(): string {
        return this.publicKey.export({
            type: "spki",
            format: "pem",
        }) as string;
    }

    /**
     * Emette la credenziale verificabile per il lavoratore autenticato:
     * 1. Verifica l'esistenza del lavoratore nel DB
     * 2. Verifica che il lavoratore sia il legittimo titolare della patente
     * 3. Crea il payload W3C standard con URN UUID
     * 4. Canonicizza deterministicamente il JSON secondo la specifica
     * 5. Firma digitalmente con la chiave privata Ed25519
     *
     * @param authenticatedWorkerId ID del lavoratore autenticato
     * @param licenseRef Riferimento pseudonimo della patente
     * @returns Credenziale verificabile firmata con prova crittografica
     */
    async issueLicenseCredential(
        authenticatedWorkerId: string,
        licenseRef: string,
    ): Promise<WorksiteLicenseCredential> {
        if (
            !authenticatedWorkerId ||
            typeof authenticatedWorkerId !== "string" ||
            authenticatedWorkerId.trim() === ""
        ) {
            throw new Error("Authenticated worker ID is required");
        }

        if (
            !licenseRef ||
            typeof licenseRef !== "string" ||
            licenseRef.trim() === ""
        ) {
            throw new Error("License reference is required");
        }

        const normalizedWorkerId = authenticatedWorkerId.trim();
        const normalizedLicenseRef = licenseRef.trim();

        const worker = await this.workerRepository.findById(normalizedWorkerId);
        if (!worker) {
            throw new Error(`Worker not found: ${normalizedWorkerId}`);
        }

        let isAuthorized = false;
        if (this.licenseRepository) {
            const license = await this.licenseRepository.findByWorkerId(normalizedWorkerId);
            if (license && (license.licenseRef === normalizedLicenseRef || license.licenseId === normalizedLicenseRef)) {
                isAuthorized = true;
            }
        }
        if (!isAuthorized && worker.licenseId) {
            if (worker.licenseId === normalizedLicenseRef) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            throw new Error(
                `Worker ${normalizedWorkerId} is not authorized for license ${normalizedLicenseRef}`,
            );
        }

        const credentialId = `urn:uuid:${crypto.randomUUID()}`;
        const issuanceDate = new Date().toISOString();
        const proofCreated = new Date().toISOString();
        const types = [...DEFAULT_CREDENTIAL_TYPE];
        const credentialSubject = {
            workerId: normalizedWorkerId,
            licenseRef: normalizedLicenseRef,
        };

        const canonicalPayload = canonicalizeCredentialPayload({
            id: credentialId,
            type: types,
            issuer: this.issuerId,
            issuanceDate,
            credentialSubject,
            proofCreated,
        });

        const signatureBuffer = crypto.sign(
            null,
            Buffer.from(canonicalPayload, "utf-8"),
            this.privateKey,
        );
        const signature = signatureBuffer.toString("base64");

        return {
            id: credentialId,
            type: types,
            issuer: this.issuerId,
            issuanceDate,
            credentialSubject,
            proof: {
                type: DEFAULT_PROOF_TYPE,
                created: proofCreated,
                proofPurpose: DEFAULT_PROOF_PURPOSE,
                verificationMethod: this.verificationMethod,
                signature,
            },
        };
    }
}
