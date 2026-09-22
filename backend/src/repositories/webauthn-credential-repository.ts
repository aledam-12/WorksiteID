/**
 * @file webauthn-credential-repository.ts
 * @description Repository di persistenza per le credenziali biometriche e passkey WebAuthn/FIDO2.
 * Offre implementazioni sia in-memory (per test unitari isolati) sia su database MySQL relazionale
 * con gestione della chiave pubblica, contatore anticlonazione e trasporti dell'autenticatore.
 *
 * @dependencies
 * - mysql2/promise: driver asincrono per connessioni e query al database MySQL.
 * - domain/webauthn-credentials.js: entità di dominio WebAuthnCredentials ed enum WebAuthnUserType.
 */

import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader, QueryError } from "mysql2/promise";
import { WebAuthnCredentials, WebAuthnUserType } from "../domain/webauthn-credentials.js";

/**
 * Contratto per il repository delle credenziali WebAuthn / Passkey.
 */
export interface WebAuthnCredentialRepository {
    /**
     * Registra una nuova credenziale WebAuthn associata a un utente.
     * @param credential Oggetto credenziale di dominio
     */
    register(credential: WebAuthnCredentials): Promise<void>;

    /**
     * Trova una credenziale dato il suo identificativo univoco (Base64URL).
     * @param id Identificativo della credenziale
     */
    findById(id: string): Promise<WebAuthnCredentials | null>;

    /**
     * Recupera tutte le credenziali passkey registrate per un determinato utente.
     * @param userId Identificativo dell'utente
     */
    findByUserId(userId: string): Promise<WebAuthnCredentials[]>;

    /**
     * Verifica l'esistenza di una credenziale tramite il suo identificativo.
     * @param id Identificativo della credenziale
     */
    existsById(id: string): Promise<boolean>;

    /**
     * Aggiorna il contatore anticlonazione della credenziale a seguito di un login verificato.
     * @param id Identificativo della credenziale
     * @param counter Nuovo valore del contatore
     */
    updateCounter?(id: string, counter: number): Promise<void>;

    /**
     * Elimina una credenziale memorizzata.
     * @param id Identificativo della credenziale da rimuovere
     */
    delete?(id: string): Promise<boolean>;
}

// Backward-compatible interface alias
export type CredentialRepository = WebAuthnCredentialRepository;

/**
 * Implementazione in-memory del repository WebAuthn per test e mock veloci.
 */
export class InMemoryWebAuthnCredentialRepository implements WebAuthnCredentialRepository {
    private credentials: Map<string, WebAuthnCredentials> = new Map();

    constructor(initialCredentials: WebAuthnCredentials[] = []) {
        initialCredentials.forEach((credential) => {
            this.credentials.set(credential.id, credential);
        });
    }

    async register(credential: WebAuthnCredentials): Promise<void> {
        if (await this.existsById(credential.id)) {
            throw new Error("Credential already exists");
        }
        this.credentials.set(credential.id, credential);
    }

    async findById(id: string): Promise<WebAuthnCredentials | null> {
        return this.credentials.get(id) ?? null;
    }

    async findByUserId(userId: string): Promise<WebAuthnCredentials[]> {
        const results: WebAuthnCredentials[] = [];
        for (const credential of this.credentials.values()) {
            if (credential.userId === userId) {
                results.push(credential);
            }
        }
        return results;
    }

    async existsById(id: string): Promise<boolean> {
        return this.credentials.has(id);
    }

    async updateCounter(id: string, counter: number): Promise<void> {
        const cred = this.credentials.get(id);
        if (!cred) {
            throw new Error("Credential not found");
        }
        cred.updateCounter(counter);
        cred.updateLastUsed();
    }

    async delete(id: string): Promise<boolean> {
        return this.credentials.delete(id);
    }
}

// Backward-compatible class alias
export const InMemoryCredentialRepository = InMemoryWebAuthnCredentialRepository;

interface CredentialRow extends RowDataPacket {
    credential_id: Buffer | string;
    user_id: string;
    public_key: Buffer | string;
    counter: number | string;
    transports: string | string[] | null;
    created_at: Date;
    last_used_at: Date | null;
    user_type: "worker" | "inspector";
}

/**
 * Implementazione su database relazionale MySQL del repository delle credenziali WebAuthn.
 */
export class MySqlWebAuthnCredentialRepository implements WebAuthnCredentialRepository {
    constructor(private readonly pool: Pool) {}

    private mapRowToDomain(row: CredentialRow): WebAuthnCredentials {
        const id = Buffer.isBuffer(row.credential_id)
            ? row.credential_id.toString("base64url")
            : String(row.credential_id);

        const publicKey = Buffer.isBuffer(row.public_key)
            ? row.public_key.toString("base64url")
            : String(row.public_key);

        const userType =
            row.user_type === "worker"
                ? WebAuthnUserType.WORKER
                : WebAuthnUserType.INSPECTOR;

        let transports: string[] | undefined = undefined;
        if (row.transports) {
            if (typeof row.transports === "string") {
                try {
                    transports = JSON.parse(row.transports) as string[];
                } catch {
                    // Ignore parse errors
                }
            } else if (Array.isArray(row.transports)) {
                transports = row.transports;
            }
        }

        return new WebAuthnCredentials(
            id,
            row.user_id,
            userType,
            publicKey,
            Number(row.counter),
            transports,
            row.created_at ? new Date(row.created_at) : undefined,
            row.last_used_at ? new Date(row.last_used_at) : null,
        );
    }

    async register(credential: WebAuthnCredentials, connection?: PoolConnection): Promise<void> {
        const executor = connection ?? this.pool;
        try {
            const credentialIdBuf = Buffer.from(credential.id, "base64url");
            const publicKeyBuf = Buffer.from(credential.publicKey, "base64url");
            const transportsJson = credential.transports
                ? JSON.stringify(credential.transports)
                : null;

            await executor.execute(
                `INSERT INTO webauthn_credentials 
                    (user_id, credential_id, public_key, counter, transports, created_at, last_used_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    credential.userId,
                    credentialIdBuf,
                    publicKeyBuf,
                    credential.counter,
                    transportsJson,
                    credential.createdAt ?? new Date(),
                    credential.lastUsedAt ?? null,
                ],
            );
        } catch (error: unknown) {
            const dbError = error as Partial<QueryError> | undefined;
            if (dbError?.code === "ER_DUP_ENTRY") {
                throw new Error("Credential already exists", { cause: error });
            }
            throw error;
        }
    }

    async findById(id: string, connection?: PoolConnection): Promise<WebAuthnCredentials | null> {
        const executor = connection ?? this.pool;
        const idBuf = Buffer.from(id, "base64url");
        const [rows] = await executor.execute<CredentialRow[]>(
            `SELECT c.credential_id, c.user_id, c.public_key, c.counter, c.transports, c.created_at, c.last_used_at, u.user_type
             FROM webauthn_credentials c
             JOIN users u ON u.id = c.user_id
             WHERE c.credential_id = ?`,
            [idBuf],
        );

        if (rows.length === 0 || !rows[0]) {
            return null;
        }

        return this.mapRowToDomain(rows[0]);
    }

    async findByUserId(userId: string, connection?: PoolConnection): Promise<WebAuthnCredentials[]> {
        const executor = connection ?? this.pool;
        const [rows] = await executor.execute<CredentialRow[]>(
            `SELECT c.credential_id, c.user_id, c.public_key, c.counter, c.transports, c.created_at, c.last_used_at, u.user_type
             FROM webauthn_credentials c
             JOIN users u ON u.id = c.user_id
             WHERE c.user_id = ?
             ORDER BY c.created_at ASC`,
            [userId],
        );

        return rows.map((row) => this.mapRowToDomain(row));
    }

    async existsById(id: string, connection?: PoolConnection): Promise<boolean> {
        const executor = connection ?? this.pool;
        const idBuf = Buffer.from(id, "base64url");
        const [rows] = await executor.execute<RowDataPacket[]>(
            "SELECT 1 FROM webauthn_credentials WHERE credential_id = ? LIMIT 1",
            [idBuf],
        );
        return rows.length > 0;
    }

    async updateCounter(id: string, newCounter: number, connection?: PoolConnection): Promise<void> {
        const executor = connection ?? this.pool;
        const idBuf = Buffer.from(id, "base64url");
        const [result] = await executor.execute<ResultSetHeader>(
            `UPDATE webauthn_credentials 
             SET counter = ?, last_used_at = CURRENT_TIMESTAMP
             WHERE credential_id = ?`,
            [newCounter, idBuf],
        );

        if (result.affectedRows === 0) {
            throw new Error("Credential not found");
        }
    }

    async delete(id: string, connection?: PoolConnection): Promise<boolean> {
        const executor = connection ?? this.pool;
        const idBuf = Buffer.from(id, "base64url");
        const [result] = await executor.execute<ResultSetHeader>(
            "DELETE FROM webauthn_credentials WHERE credential_id = ?",
            [idBuf],
        );
        return result.affectedRows > 0;
    }
}

// Backward-compatible class alias
export const MySqlCredentialRepository = MySqlWebAuthnCredentialRepository;
