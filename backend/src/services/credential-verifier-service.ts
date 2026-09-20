import crypto from "node:crypto";
import fs from "node:fs";
import {
    canonicalizeCredentialPayload,
    DEFAULT_PROOF_PURPOSE,
    DEFAULT_PROOF_TYPE,
    WorksiteLicenseCredential,
} from "../domain/verifiable-credential.js";
import { envConfig } from "../config/index.js";

/**
 * Configurazione per il Verifier delle Verifiable Credential.
 */
export interface CredentialVerifierConfig {
    expectedIssuer?: string;
    expectedVerificationMethod?: string;
    publicKeyPem?: string;
    publicKeyPath?: string;
    publicKey?: crypto.KeyObject;
}

/**
 * Interfaccia del servizio per la verifica delle Verifiable Credential.
 */
export interface CredentialVerifierService {
    /**
     * Verifica la validità strutturale e la firma crittografica della credenziale.
     *
     * @param credential Verifiable Credential da verificare
     * @returns true se la credenziale è autentica, integra e valida; false altrimenti
     */
    verifyCredential(credential: WorksiteLicenseCredential): Promise<boolean>;
}

/**
 * Implementazione del servizio Verifier per la demo universitaria.
 * Esegue la validazione dei tipi, dell'issuer atteso, del verificationMethod
 * e la verifica crittografica della firma Ed25519 standard.
 */
export class CredentialVerifierServiceImpl
    implements CredentialVerifierService
{
    private readonly expectedIssuer: string;
    private readonly expectedVerificationMethod: string;
    private readonly publicKey: crypto.KeyObject;

    constructor(config: CredentialVerifierConfig = {}) {
        let publicKeyPem = config.publicKeyPem;
        if (!config.publicKey && !publicKeyPem) {
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

        if (!config.publicKey && !publicKeyPem) {
            throw new Error(
                "CredentialVerifier requires a public key (publicKey, publicKeyPem, or publicKeyPath)",
            );
        }

        this.publicKey = config.publicKey
            ? config.publicKey
            : crypto.createPublicKey(publicKeyPem!);

        this.expectedIssuer =
            config.expectedIssuer?.trim() ||
            envConfig.vcIssuerId ||
            envConfig.fireflyIssuerId ||
            "worksiteid-issuer";

        this.expectedVerificationMethod =
            config.expectedVerificationMethod?.trim() ||
            `${this.expectedIssuer}#key-1`;
    }

    /**
     * Valida la credenziale e ne verifica la firma digitale Ed25519.
     */
    async verifyCredential(
        credential: WorksiteLicenseCredential,
    ): Promise<boolean> {
        // 1. Controllo presenza oggetto credenziale
        if (!credential || typeof credential !== "object") {
            return false;
        }

        // 2. Controllo presenza e validità ID
        if (
            !credential.id ||
            typeof credential.id !== "string" ||
            credential.id.trim() === ""
        ) {
            return false;
        }

        // 3. Controllo tipi della credenziale (VerifiableCredential e WorksiteLicenseCredential)
        if (
            !Array.isArray(credential.type) ||
            !credential.type.includes("VerifiableCredential") ||
            !credential.type.includes("WorksiteLicenseCredential")
        ) {
            return false;
        }

        // 4. Controllo issuer atteso
        if (
            !credential.issuer ||
            typeof credential.issuer !== "string" ||
            credential.issuer.trim() !== this.expectedIssuer
        ) {
            return false;
        }

        // 5. Controllo data di emissione valida
        if (
            !credential.issuanceDate ||
            typeof credential.issuanceDate !== "string" ||
            Number.isNaN(Date.parse(credential.issuanceDate))
        ) {
            return false;
        }

        // 6. Controllo soggetto della credenziale (credentialSubject)
        const subject = credential.credentialSubject;
        if (!subject || typeof subject !== "object") {
            return false;
        }
        if (
            !subject.workerId ||
            typeof subject.workerId !== "string" ||
            subject.workerId.trim() === ""
        ) {
            return false;
        }
        if (
            !subject.licenseRef ||
            typeof subject.licenseRef !== "string" ||
            subject.licenseRef.trim() === ""
        ) {
            return false;
        }

        // 7. Controllo prova crittografica (proof)
        const proof = credential.proof;
        if (!proof || typeof proof !== "object") {
            return false;
        }
        if (proof.type !== DEFAULT_PROOF_TYPE) {
            return false;
        }
        if (
            !proof.created ||
            typeof proof.created !== "string" ||
            Number.isNaN(Date.parse(proof.created))
        ) {
            return false;
        }
        if (proof.proofPurpose !== DEFAULT_PROOF_PURPOSE) {
            return false;
        }
        // Il verifier controlla che il verificationMethod corrisponda a quello atteso per l'issuer
        if (proof.verificationMethod !== this.expectedVerificationMethod) {
            return false;
        }
        if (
            !proof.signature ||
            typeof proof.signature !== "string" ||
            proof.signature.trim() === ""
        ) {
            return false;
        }

        // 8. Ricostruzione del payload deterministico per la verifica
        const canonicalPayload = canonicalizeCredentialPayload(credential);

        // 9. Verifica crittografica della firma con la chiave pubblica dell'Issuer
        try {
            const signatureBuffer = Buffer.from(proof.signature, "base64");
            const isValid = crypto.verify(
                null,
                Buffer.from(canonicalPayload, "utf-8"),
                this.publicKey,
                signatureBuffer,
            );
            return isValid;
        } catch {
            return false;
        }
    }
}
