import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader, QueryError } from "mysql2/promise";
import { User } from "../domain/user.js";
import { WebAuthnUserType } from "../domain/webauthn-credentials.js";

export interface UserRepository {
    register(user: User): Promise<void>;
    findById(id: string): Promise<User | null>;
    existsById(id: string): Promise<boolean>;
    delete(id: string): Promise<boolean>;
}

export class InMemoryUserRepository implements UserRepository {
    private users: Map<string, User> = new Map();

    async register(user: User): Promise<void> {
        if (await this.existsById(user.id)) {
            throw new Error("User already exists");
        }
        this.users.set(user.id, user);
    }

    async findById(id: string): Promise<User | null> {
        return this.users.get(id) ?? null;
    }

    async existsById(id: string): Promise<boolean> {
        return this.users.has(id);
    }

    async delete(id: string): Promise<boolean> {
        return this.users.delete(id);
    }
}

interface UserRow extends RowDataPacket {
    id: string;
    user_type: "worker" | "inspector";
    created_at: Date;
}

export class MySqlUserRepository implements UserRepository {
    constructor(private readonly pool: Pool) {}

    async register(user: User, connection?: PoolConnection): Promise<void> {
        const executor = connection ?? this.pool;
        try {
            await executor.execute(
                "INSERT INTO users (id, user_type, created_at) VALUES (?, ?, ?)",
                [user.id, user.userType, user.createdAt],
            );
        } catch (error: unknown) {
            const dbError = error as Partial<QueryError> | undefined;
            if (dbError?.code === "ER_DUP_ENTRY") {
                throw new Error("User already exists", { cause: error });
            }
            throw error;
        }
    }

    async findById(id: string, connection?: PoolConnection): Promise<User | null> {
        const executor = connection ?? this.pool;
        const [rows] = await executor.execute<UserRow[]>(
            "SELECT id, user_type, created_at FROM users WHERE id = ?",
            [id],
        );

        if (rows.length === 0 || !rows[0]) {
            return null;
        }

        const row = rows[0];
        return new User({
            id: row.id,
            userType: row.user_type === "worker" ? WebAuthnUserType.WORKER : WebAuthnUserType.INSPECTOR,
            createdAt: new Date(row.created_at),
        });
    }

    async existsById(id: string, connection?: PoolConnection): Promise<boolean> {
        const executor = connection ?? this.pool;
        const [rows] = await executor.execute<RowDataPacket[]>(
            "SELECT 1 FROM users WHERE id = ? LIMIT 1",
            [id],
        );
        return rows.length > 0;
    }

    async delete(id: string, connection?: PoolConnection): Promise<boolean> {
        const executor = connection ?? this.pool;
        const [result] = await executor.execute<ResultSetHeader>(
            "DELETE FROM users WHERE id = ?",
            [id],
        );
        return result.affectedRows > 0;
    }
}
