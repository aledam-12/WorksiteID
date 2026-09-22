/**
 * @file webauthn.service.ts
 * @description Modulo per l'orchestrazione dell'autenticazione biometrica FIDO2 / WebAuthn (Passkeys).
 * Fornisce un wrapper lineare e standard attorno a @simplewebauthn/server per la generazione
 * delle sfide crittografiche e la verifica delle firme hardware di registrazione e login.
 *
 * @dependencies
 * - @simplewebauthn/server: libreria per opzioni e verifica FIDO2.
 * - @simplewebauthn/server/helpers: helper di conversione Base64URL e Uint8Array.
 */

import {
    generateRegistrationOptions,
    generateAuthenticationOptions,
    verifyRegistrationResponse,
    verifyAuthenticationResponse,
    type PublicKeyCredentialCreationOptionsJSON,
    type PublicKeyCredentialRequestOptionsJSON,
    type RegistrationResponseJSON,
    type AuthenticationResponseJSON,
    type VerifiedRegistrationResponse,
    type VerifiedAuthenticationResponse,
    type GenerateRegistrationOptionsOpts,
    type GenerateAuthenticationOptionsOpts,
} from "@simplewebauthn/server";
import { isoBase64URL, isoUint8Array } from "@simplewebauthn/server/helpers";

/**
 * Configurazione opzionale per il Relying Party (RP) WebAuthn.
 */
export interface WebAuthnServiceConfig {
    /** Nome dell'applicazione mostrato all'utente (es. "WorksiteID") */
    rpName?: string;
    /** Identificativo di dominio del Relying Party (es. "localhost") */
    rpID?: string;
    /** Origine HTTP attesa del client */
    origin?: string;
    /** Elenco di origini permesse per ambienti locali e di sviluppo */
    allowedOrigins?: string[];
}

/**
 * Contratto per il servizio di autenticazione e registrazione WebAuthn.
 */
export interface WebAuthnService {
    /**
     * Genera le opzioni crittografiche per la registrazione di una nuova passkey.
     * @param params Dati identificativi dell'utente e credenziali da escludere
     */
    generateRegistrationOptions(params: {
        userId: string;
        userName: string;
        excludeCredentialIds?: string[];
    }): Promise<PublicKeyCredentialCreationOptionsJSON>;

    /**
     * Valida crittograficamente la risposta di registrazione inviata dall'autenticatore del browser.
     * @param params Risposta dell'autenticatore e challenge attesa
     */
    verifyRegistrationResponse(params: {
        response: RegistrationResponseJSON;
        expectedChallenge: string;
    }): Promise<VerifiedRegistrationResponse>;

    /**
     * Genera le opzioni crittografiche per il login con passkey (discoverable credentials).
     * @param params Elenco opzionale di ID credenziali consentite
     */
    generateAuthenticationOptions(params?: {
        allowCredentialIds?: string[];
    }): Promise<PublicKeyCredentialRequestOptionsJSON>;

    /**
     * Valida la firma digitale prodotta dall'hardware durante il login e controlla il contatore anticlonazione.
     * @param params Risposta dell'autenticatore, challenge attesa e chiave pubblica memorizzata
     */
    verifyAuthenticationResponse(params: {
        response: AuthenticationResponseJSON;
        expectedChallenge: string;
        credential: {
            id: string;
            publicKey: string; // Base64URL string
            counter: number;
        };
    }): Promise<VerifiedAuthenticationResponse>;
}

/**
 * Implementazione concreta di WebAuthnService basata sullo standard W3C WebAuthn / FIDO2.
 */
export class WebAuthnServiceImpl implements WebAuthnService {
    readonly #rpName: string;
    readonly #rpID: string;
    readonly #origin: string;
    readonly #allowedOrigins: string[];

    constructor(config?: Partial<WebAuthnServiceConfig>) {
        this.#rpName = config?.rpName ?? "WorksiteID";
        this.#rpID = config?.rpID ?? process.env.RP_ID ?? "localhost";
        this.#origin = config?.origin ?? process.env.ORIGIN ?? "http://localhost:3000";
        this.#allowedOrigins = Array.from(new Set([
            this.#origin,
            ...(config?.allowedOrigins ?? []),
            "http://localhost:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
        ]));
    }

    /**
     * Prepara le opzioni per PublicKeyCredential.create() con userVerification obbligatoria.
     */
    async generateRegistrationOptions(params: {
        userId: string;
        userName: string;
        excludeCredentialIds?: string[];
    }): Promise<PublicKeyCredentialCreationOptionsJSON> {
        const opts: GenerateRegistrationOptionsOpts = {
            rpName: this.#rpName,
            rpID: this.#rpID,
            userName: params.userName,
            userID: isoUint8Array.fromUTF8String(params.userId),
            attestationType: "none",
            authenticatorSelection: {
                userVerification: "required",
                residentKey: "required",
            },
        };

        if (params.excludeCredentialIds && params.excludeCredentialIds.length > 0) {
            opts.excludeCredentials = params.excludeCredentialIds.map((id) => ({ id }));
        }

        return generateRegistrationOptions(opts);
    }

    /**
     * Valida l'attestazione della passkey registrata estraendo chiave pubblica e contatore.
     */
    async verifyRegistrationResponse(params: {
        response: RegistrationResponseJSON;
        expectedChallenge: string;
    }): Promise<VerifiedRegistrationResponse> {
        return verifyRegistrationResponse({
            response: params.response,
            expectedChallenge: params.expectedChallenge,
            expectedOrigin: this.#allowedOrigins,
            expectedRPID: this.#rpID,
        });
    }

    /**
     * Prepara le opzioni per PublicKeyCredential.get() per l'autenticazione passwordless.
     */
    async generateAuthenticationOptions(params?: {
        allowCredentialIds?: string[];
    }): Promise<PublicKeyCredentialRequestOptionsJSON> {
        const opts: GenerateAuthenticationOptionsOpts = {
            rpID: this.#rpID,
            userVerification: "required",
        };

        if (params?.allowCredentialIds && params.allowCredentialIds.length > 0) {
            opts.allowCredentials = params.allowCredentialIds.map((id) => ({ id }));
        }

        return generateAuthenticationOptions(opts);
    }

    /**
     * Verifica la firma della challenge generata dalla chiave privata hardware dell'utente.
     */
    async verifyAuthenticationResponse(params: {
        response: AuthenticationResponseJSON;
        expectedChallenge: string;
        credential: {
            id: string;
            publicKey: string;
            counter: number;
        };
    }): Promise<VerifiedAuthenticationResponse> {
        return verifyAuthenticationResponse({
            response: params.response,
            expectedChallenge: params.expectedChallenge,
            expectedOrigin: this.#allowedOrigins,
            expectedRPID: this.#rpID,
            credential: {
                id: params.credential.id,
                publicKey: isoBase64URL.toBuffer(params.credential.publicKey),
                counter: params.credential.counter,
            },
        });
    }
}
