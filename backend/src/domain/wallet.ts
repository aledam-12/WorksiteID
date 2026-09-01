import { WebAuthnUserType } from "./webauthn-credentials.js";

export class Wallet {
    constructor(
        public readonly userId: string,
        public readonly userType: WebAuthnUserType,
    ) {
        // validazioniuserId non vuoto; userType deve essere WORKER oppure INSPECTOR
        if (userId === null || userId === undefined || userId.trim() === "") {
            throw new Error("User ID cannot be empty");
        }
        if (userType !== WebAuthnUserType.INSPECTOR && userType !== WebAuthnUserType.WORKER) {
            throw new Error("User type cannot be empty or invalid");
        }
    }
}