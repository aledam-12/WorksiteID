export enum WebAuthnUserType {
    WORKER = "worker",
    INSPECTOR = "inspector",
}

export class WebAuthnCredentials {
    readonly #id: string;
    readonly #userId: string;
    readonly #userType: WebAuthnUserType;
    readonly #publicKey: string;
    #counter: number;

    constructor(
        id: string,
        userId: string,
        userType: WebAuthnUserType,
        publicKey: string,
        counter: number,
    ) {
        this.#id = WebAuthnCredentials.validateId(id);
        this.#userId = WebAuthnCredentials.validateUserId(userId);
        this.#userType = WebAuthnCredentials.validateUserType(userType);
        this.#publicKey = WebAuthnCredentials.validatePublicKey(publicKey);
        this.#counter = WebAuthnCredentials.validateCounter(counter);
    }

    get id(): string {
        return this.#id;
    }

    get userId(): string {
        return this.#userId;
    }

    get userType(): WebAuthnUserType {
        return this.#userType;
    }

    get publicKey(): string {
        return this.#publicKey;
    }

    get counter(): number {
        return this.#counter;
    }

    updateCounter(newCounter: number): void {
        WebAuthnCredentials.validateCounter(newCounter);
        if (newCounter <= this.#counter) {
            throw new Error("New counter must be greater than current counter");
        }
        this.#counter = newCounter;
    }

    static validateId(id: string): string {
        if (!id || id.trim() === "") {
            throw new Error("Credential ID must not be empty");
        }
        return id.trim();
    }

    static validateUserId(userId: string): string {
        if (!userId || userId.trim() === "") {
            throw new Error("User ID must not be empty");
        }
        return userId.trim();
    }

    static validatePublicKey(publicKey: string): string {
        if (!publicKey || publicKey.trim() === "") {
            throw new Error("Public key must not be empty");
        }
        return publicKey.trim();
    }

    static validateCounter(counter: number): number {
        if (counter < 0) {
            throw new Error("Counter must be greater than or equal to 0");
        }
        return counter;
    }

    static validateUserType(userType: WebAuthnUserType): WebAuthnUserType {
        if (!Object.values(WebAuthnUserType).includes(userType)) {
            throw new Error("Invalid user type");
        }
        return userType;
    }
}