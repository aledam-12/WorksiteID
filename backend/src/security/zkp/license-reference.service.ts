/**
 * @file license-reference.service.ts
 * @description Servizio per la derivazione deterministica e la verifica sicura di identificativi pseudonimi di patente (licenseRef).
 * Utilizza HMAC-SHA256 con chiave segreta per generare un riferimento non invertibile che protegge l'identità reale del lavoratore su ledger e circuiti ZKP.
 *
 * @dependencies
 * - node:crypto: creazione di HMAC crittografici SHA-256 e confronto timing-safe (timingSafeEqual).
 * - config/index.js: lettura del segreto applicativo configurato in LICENSE_REF_SECRET.
 */

import crypto from "node:crypto";
import { config } from "../../config/index.js";

/**
 * Servizio crittografico per la gestione dei riferimenti pseudonimi di patente (licenseRef).
 */
export class LicenseReferenceService {
    readonly #secret: string;

    /**
     * Inizializza il servizio con la chiave segreta HMAC.
     * @param secret Chiave segreta opzionale (se omessa, utilizza config.licenseRefSecret)
     * @throws {Error} Se la chiave segreta è assente o vuota
     */
    constructor(secret?: string) {
        const resolvedSecret = secret ?? config.licenseRefSecret;
        if (!resolvedSecret || typeof resolvedSecret !== "string" || resolvedSecret.trim() === "") {
            throw new Error("LICENSE_REF_SECRET is required and cannot be empty");
        }
        this.#secret = resolvedSecret;
    }

    /**
     * Genera un identificativo pseudonimo deterministico (licenseRef) da un ID di patente in chiaro.
     * Calcola HMAC-SHA256(secret, licenseId.trim()) e restituisce il digest esadecimale in minuscolo.
     *
     * @param licenseId Identificativo reale della patente da pseudonimizzare
     * @returns Stringa esadecimale a 64 caratteri del digest HMAC-SHA256
     * @throws {Error} Se licenseId è nullo, indefinito o vuoto
     */
    generateLicenseRef(licenseId: string): string {
        if (!licenseId || typeof licenseId !== "string" || licenseId.trim() === "") {
            throw new Error("licenseId is required and cannot be empty");
        }
        return crypto
            .createHmac("sha256", this.#secret)
            .update(licenseId.trim())
            .digest("hex");
    }

    /**
     * Verifica la corrispondenza tra un licenseId in chiaro e un licenseRef pseudonimo.
     * Utilizza crypto.timingSafeEqual per prevenire vulnerabilità a timing attacks.
     *
     * @param licenseId Identificativo reale della patente
     * @param licenseRef Digest pseudonimo da verificare
     * @returns true se il riferimento corrisponde, false altrimenti
     */
    verifyLicenseRef(licenseId: string, licenseRef: string): boolean {
        if (!licenseId || typeof licenseId !== "string" || licenseId.trim() === "") {
            return false;
        }
        if (!licenseRef || typeof licenseRef !== "string" || licenseRef.trim() === "") {
            return false;
        }

        const expected = this.generateLicenseRef(licenseId);
        const expectedBuf = Buffer.from(expected, "utf-8");
        const providedBuf = Buffer.from(licenseRef.trim().toLowerCase(), "utf-8");

        if (expectedBuf.length !== providedBuf.length) {
            return false;
        }

        return crypto.timingSafeEqual(expectedBuf, providedBuf);
    }
}
