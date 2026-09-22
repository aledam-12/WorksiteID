/**
 * @file credential.routes.ts
 * @description Controller delle rotte pubbliche per la verifica delle Verifiable Credentials.
 * Consente a chiunque (committenti, varchi esterni, ispettori non autenticati) di validare
 * offline e matematicamente la firma digitale Ed25519 e l'integrità del payload W3C della patente.
 *
 * @dependencies
 * - fastify: framework HTTP per la definizione delle rotte REST.
 * - security/vc/vc-verifier.service.js: motore di verifica crittografica W3C.
 * - domain/verifiable-credential.js: tipo WorksiteLicenseCredential.
 */

import { type FastifyInstance } from "fastify";
import { type CredentialVerifierService } from "../security/vc/vc-verifier.service.js";
import { type WorksiteLicenseCredential } from "../domain/verifiable-credential.js";

/**
 * Dipendenze richieste dal controller delle credenziali verificabili.
 */
export interface CredentialRoutesContext {
    verifierService: CredentialVerifierService;
}

/**
 * Registra gli endpoint di verifica pubblica delle credenziali nell'applicazione Fastify.
 * @param app Istanza Fastify
 * @param ctx Servizi di verifica delle credenziali
 */
export function registerCredentialRoutes(app: FastifyInstance, ctx: CredentialRoutesContext): void {
    const { verifierService } = ctx;

    // Endpoint pubblico di verifica crittografica W3C Verifiable Credential
    app.post("/api/public/credential/verify", async (request) => {
        const body = request.body as { credentialData?: unknown } | undefined;
        let credentialObj = body?.credentialData;

        if (typeof credentialObj === "string") {
            try {
                credentialObj = JSON.parse(credentialObj);
            } catch {
                return {
                    result: "NOT_PASS",
                    verifiedAt: new Date().toLocaleString("it-IT"),
                    reason: "Malformed JSON credential data",
                };
            }
        }

        if (!credentialObj || typeof credentialObj !== "object") {
            return {
                result: "NOT_PASS",
                verifiedAt: new Date().toLocaleString("it-IT"),
                reason: "Invalid credential format",
            };
        }

        const cred = credentialObj as unknown as WorksiteLicenseCredential;
        const isValid = await verifierService.verifyCredential(cred);

        return {
            result: isValid ? "PASS" : "NOT_PASS",
            verifiedAt: new Date().toLocaleString("it-IT"),
            credentialSubject: cred.credentialSubject,
            issuer: cred.issuer,
            reason: isValid ? undefined : "Cryptographic signature or credential structure is invalid",
        };
    });
}
