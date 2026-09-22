/**
 * @file vc-verifier.service.ts
 * @description Servizio per la verifica crittografica di Verifiable Credentials W3C per le patenti di cantiere.
 * Valida la struttura formale del JSON, il contesto W3C, l'emittente autorizzato e la firma asimmetrica Ed25519.
 *
 * @dependencies
 * - node:crypto: verifica crittografica della firma digitale con chiave pubblica Ed25519 (crypto.verify).
 * - node:fs: caricamento della chiave pubblica PEM da filesystem se configurata via percorso.
 * - domain/verifiable-credential.js: costanti W3C, canonicizzazione deterministica e tipi di credenziale.
 * - config/index.js: parametri d'ambiente per percorsi chiavi e identificativo emittente atteso.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import {
    canonicalizeCredentialPayload,
    DEFAULT_PROOF_PURPOSE,
    DEFAULT_PROOF_TYPE,
    type WorksiteLicenseCredential,
} from "../../domain/verifiable-credential.js";
import { envConfig } from "../../config/index.js";

/**
 * Parametri di configurazione crittografica per il Verifier delle Verifiable Credentials.
 */
export interface CredentialVerifierConfig {
    /** Identificativo DID o URI dell'emittente atteso */
    expectedIssuer?: string;
    /** URI atteso del metodo di verifica (verificationMethod) */
    expectedVerificationMethod?: string;
    /** Chiave pubblica in formato PEM SPKI */
    publicKeyPem?: string;
    /** Percorso sul filesystem al file PEM della chiave pubblica */
    publicKeyPath?: string;
    /** Istanza KeyObject già inizializzata della chiave pubblica */
    publicKey?: crypto.KeyObject;
}

/**
 * Contratto per il servizio di verifica delle Verifiable Credentials W3C.
 */
export interface CredentialVerifierService {
    /**
     * Verifica la validità strutturale e la firma crittografica Ed25519 di una Verifiable Credential.
     *
     * @param credential La credenziale verificabile da analizzare
     * @returns true se la credenziale è integra e autentica, false altrimenti
     */
    verifyCredential(credential: WorksiteLicenseCredential): Promise<boolean>;
}

/**
 * Implementazione concreta del verificatore W3C con supporto crittografico Ed25519.
 */
export class CredentialVerifierServiceImpl
    implements CredentialVerifierService
{
    private readonly expectedIssuer: string;
    private readonly expectedVerificationMethod: string;
    private readonly publicKey: crypto.KeyObject;

    /**
     * Inizializza il verifier caricando la chiave pubblica dell'emittente da oggetto, stringa PEM o file.
     *
     * @param config Configurazione opzionale del verifier
     * @throws {Error} Se non viene fornita alcuna chiave pubblica valida
     */
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
     * Verifica la conformità e la firma digitale della Verifiable Credential:
     * 1. Verifica campi obbligatori (id, type, issuer, issuanceDate)
     * 2. Verifica coerenza dell'issuer con quello atteso
     * 3. Verifica presenza dei campi minimi in credentialSubject (workerId, licenseRef)
     * 4. Valida i metadati della proof (tipo Ed25519Signature2020, purpose, verificationMethod)
     * 5. Canonicizza deterministicamente il payload
     * 6. Verifica la firma digitale Ed25519 tramite crypto.verify
     *
     * @param credential Credenziale verificabile da validare
     * @returns true se tutti i controlli hanno esito positivo, false altrimenti
     */
    async verifyCredential(
        credential: WorksiteLicenseCredential,
    ): Promise<boolean> {
        if (!credential || typeof credential !== "object") {
            return false;
        }

        if (
            !credential.id ||
            typeof credential.id !== "string" ||
            credential.id.trim() === ""
        ) {
            return false;
        }

        if (
            !Array.isArray(credential.type) ||
            !credential.type.includes("VerifiableCredential") ||
            !credential.type.includes("WorksiteLicenseCredential")
        ) {
            return false;
        }

        if (
            !credential.issuer ||
            typeof credential.issuer !== "string" ||
            credential.issuer.trim() !== this.expectedIssuer
        ) {
            return false;
        }

        if (
            !credential.issuanceDate ||
            typeof credential.issuanceDate !== "string" ||
            Number.isNaN(Date.parse(credential.issuanceDate))
        ) {
            return false;
        }

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

        const canonicalPayload = canonicalizeCredentialPayload(credential);

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
