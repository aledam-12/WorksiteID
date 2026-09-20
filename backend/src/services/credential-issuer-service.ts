import crypto from "node:crypto";
import fs from "node:fs";
import { WorkerRepository } from "../repositories/worker-repository.js";
import { LicenseRepository } from "../repositories/license-repository.js";
import {
    canonicalizeCredentialPayload,
    DEFAULT_CREDENTIAL_TYPE,
    DEFAULT_PROOF_PURPOSE,
    DEFAULT_PROOF_TYPE,
    WorksiteLicenseCredential,
} from "../domain/verifiable-credential.js";
import { envConfig } from "../config/index.js";

/**
 * Configurazione per l'Issuer delle Verifiable Credential.
 */
export interface CredentialIssuerConfig {
    issuerId?: string;
    verificationMethod?: string;
    privateKeyPem?: string;
    publicKeyPem?: string;
    privateKeyPath?: string;
    publicKeyPath?: string;
}

/**
 * Interfaccia del servizio di emissione delle Verifiable Credential per le patenti di cantiere.
 */
export interface CredentialIssuerService {
    /**
     * Emette una Verifiable Credential per il lavoratore autenticato e la patente specificata.
     *
     * @param authenticatedWorkerId ID del lavoratore ricavato dalla sessione autenticata
     * @param licenseRef Riferimento della patente richiesta
     * @returns Verifiable Credential firmata dall'Issuer
     */
    issueLicenseCredential(
        authenticatedWorkerId: string,
        licenseRef: string,
    ): Promise<WorksiteLicenseCredential>;

    /** Restituisce la chiave pubblica dell'issuer in formato PEM SPKI */
    getPublicKeyPem(): string;

    /** Restituisce l'identificativo dell'issuer */
    getIssuerId(): string;

    /** Restituisce l'URI del metodo di verifica (chiave) dell'issuer */
    getVerificationMethod(): string;
}

/**
 * Implementazione del servizio Issuer per la demo universitaria.
 * Emette credenziali minime firmate con l'algoritmo Ed25519 standard di node:crypto.
 */
export class CredentialIssuerServiceImpl implements CredentialIssuerService {
    private readonly issuerId: string;
    private readonly verificationMethod: string;
    private readonly privateKey: crypto.KeyObject;
    private readonly publicKey: crypto.KeyObject;

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
            // In produzione, la chiave privata deve essere esplicitamente configurata
            if (envConfig.nodeEnv === "production") {
                throw new Error(
                    "Issuer private key is required in production environment (set VC_ISSUER_PRIVATE_KEY_PATH, ISSUER_PRIVATE_KEY_PATH or ISSUER_PRIVATE_KEY_PEM)",
                );
            }
            // Per ambienti di test e sviluppo locale senza chiavi fornite, fallback a coppia in-memory
            const keyPair = crypto.generateKeyPairSync("ed25519");
            this.privateKey = keyPair.privateKey;
            this.publicKey = keyPair.publicKey;
        }
    }

    getIssuerId(): string {
        return this.issuerId;
    }

    getVerificationMethod(): string {
        return this.verificationMethod;
    }

    getPublicKeyPem(): string {
        return this.publicKey.export({
            type: "spki",
            format: "pem",
        }) as string;
    }

    /**
     * Emette la Verifiable Credential dopo aver verificato l'identità autenticata
     * e la titolarità della patente nel WorkerRepository.
     */
    async issueLicenseCredential(
        authenticatedWorkerId: string,
        licenseRef: string,
    ): Promise<WorksiteLicenseCredential> {
        // 1. Validazione identità autenticata (unica fonte attendibile)
        if (
            !authenticatedWorkerId ||
            typeof authenticatedWorkerId !== "string" ||
            authenticatedWorkerId.trim() === ""
        ) {
            throw new Error("Authenticated worker ID is required");
        }

        // 2. Validazione riferimento patente
        if (
            !licenseRef ||
            typeof licenseRef !== "string" ||
            licenseRef.trim() === ""
        ) {
            throw new Error("License reference is required");
        }

        const normalizedWorkerId = authenticatedWorkerId.trim();
        const normalizedLicenseRef = licenseRef.trim();

        // 3. Verifica esistenza lavoratore nel dominio
        const worker = await this.workerRepository.findById(normalizedWorkerId);
        if (!worker) {
            throw new Error(`Worker not found: ${normalizedWorkerId}`);
        }

        // 4. Controllo autorizzativo: il lavoratore deve essere titolare della licenseRef richiesta
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

        // 5. Creazione della Verifiable Credential minimale (nessun dato privato)
        const credentialId = `urn:uuid:${crypto.randomUUID()}`;
        const issuanceDate = new Date().toISOString();
        const proofCreated = new Date().toISOString();
        const types = [...DEFAULT_CREDENTIAL_TYPE];
        const credentialSubject = {
            workerId: normalizedWorkerId,
            licenseRef: normalizedLicenseRef,
        };

        // 6. Costruzione del payload deterministico per la firma (inclusivo di proof.created)
        const canonicalPayload = canonicalizeCredentialPayload({
            id: credentialId,
            type: types,
            issuer: this.issuerId,
            issuanceDate,
            credentialSubject,
            proofCreated,
        });

        // 7. Firma digitale Ed25519 con chiave privata dell'Issuer
        const signatureBuffer = crypto.sign(
            null,
            Buffer.from(canonicalPayload, "utf-8"),
            this.privateKey,
        );
        const signature = signatureBuffer.toString("base64");

        // 8. Assemblaggio della credenziale con prova crittografica
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
