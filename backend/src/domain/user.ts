import { WebAuthnUserType } from "./webauthn-credentials.js";

export interface UserData {
    id: string;
    userType: WebAuthnUserType;
    createdAt?: Date;
}

/**
 * Entità del dominio applicativo che rappresenta l'identità comune
 * per Worker e Inspector (senza password o identità Fabric).
 */
export class User {
    readonly #id: string;
    readonly #userType: WebAuthnUserType;
    readonly #createdAt: Date;

    constructor(data: UserData) {
        if (!data.id || data.id.trim() === "") {
            throw new Error("User ID must not be empty");
        }
        if (
            !data.userType ||
            !Object.values(WebAuthnUserType).includes(data.userType)
        ) {
            throw new Error(`Invalid user type: ${data.userType}`);
        }
        this.#id = data.id.trim();
        this.#userType = data.userType;
        this.#createdAt = data.createdAt ?? new Date();
    }

    get id(): string {
        return this.#id;
    }

    get userType(): WebAuthnUserType {
        return this.#userType;
    }

    get createdAt(): Date {
        return this.#createdAt;
    }
}
