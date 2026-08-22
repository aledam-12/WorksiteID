import { WebAuthnCredentials } from "../domain/webauthn-credentials.js";


export interface CredentialRepository {

    register(credential: WebAuthnCredentials): Promise<void>;
    findById(id: string): Promise<WebAuthnCredentials | null>;
    findByUserId(userId: string): Promise<WebAuthnCredentials | null>;
    existsById(id: string): Promise<boolean>;
}

export class InMemoryCredentialRepository implements CredentialRepository {

    private credentials: Map<string, WebAuthnCredentials> = new Map();

    //USE IN TEST ONLY
    constructor(initialCredentials: WebAuthnCredentials[] = []) {
        initialCredentials.forEach(credential => {
            this.credentials.set(credential.id, credential);
        });
    }

    async register(credential: WebAuthnCredentials): Promise<void> {
        if (await this.existsById(credential.id)) throw new Error("Credential already exists");
        if (await this.findByUserId(credential.userId) !== null) throw new Error("User already has a credential");
        this.credentials.set(credential.id, credential);
    }

    async findById(id: string): Promise<WebAuthnCredentials | null> {
        return this.credentials.get(id) ?? null;
    }

    async findByUserId(userId: string): Promise<WebAuthnCredentials | null> {
        for (const credential of this.credentials.values()) {
            if (credential.userId === userId) {
                return credential;
            }
        }
        return null;
    }

    async existsById(id: string): Promise<boolean> {
        return this.credentials.has(id);
    }
}