import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader, QueryError } from "mysql2/promise";
import { Inspector } from "../domain/inspector.js";

export interface InspectorRepository {
    register(inspector: Inspector): Promise<void>;
    findById(id: string): Promise<Inspector | null>;
    existsById(id: string): Promise<boolean>;
    delete?(id: string): Promise<boolean>;
}

export class InMemoryInspectorRepository implements InspectorRepository {
    private inspectors: Map<string, Inspector> = new Map();

    async register(inspector: Inspector): Promise<void> {
        if (await this.existsById(inspector.id)) {
            throw new Error("Inspector already exists");
        }
        this.inspectors.set(inspector.id, inspector);
    }

    async findById(id: string): Promise<Inspector | null> {
        return this.inspectors.get(id) ?? null;
    }

    async existsById(id: string): Promise<boolean> {
        return this.inspectors.has(id);
    }

    async delete(id: string): Promise<boolean> {
        return this.inspectors.delete(id);
    }
}

interface InspectorRow extends RowDataPacket {
    id: string;
}

export class MySqlInspectorRepository implements InspectorRepository {
    constructor(private readonly pool: Pool) {}

    async register(inspector: Inspector, connection?: PoolConnection): Promise<void> {
        const executor = connection ?? this.pool;
        try {
            await executor.execute(
                "INSERT INTO inspectors (id) VALUES (?)",
                [inspector.id],
            );
        } catch (error: unknown) {
            const dbError = error as Partial<QueryError> | undefined;
            if (dbError?.code === "ER_DUP_ENTRY") {
                throw new Error("Inspector already exists", { cause: error });
            }
            throw error;
        }
    }

    async findById(id: string, connection?: PoolConnection): Promise<Inspector | null> {
        const executor = connection ?? this.pool;
        const [rows] = await executor.execute<InspectorRow[]>(
            "SELECT id FROM inspectors WHERE id = ?",
            [id],
        );

        if (rows.length === 0 || !rows[0]) {
            return null;
        }

        return new Inspector(rows[0].id);
    }

    async existsById(id: string, connection?: PoolConnection): Promise<boolean> {
        const executor = connection ?? this.pool;
        const [rows] = await executor.execute<RowDataPacket[]>(
            "SELECT 1 FROM inspectors WHERE id = ? LIMIT 1",
            [id],
        );
        return rows.length > 0;
    }

    async delete(id: string, connection?: PoolConnection): Promise<boolean> {
        const executor = connection ?? this.pool;
        const [result] = await executor.execute<ResultSetHeader>(
            "DELETE FROM inspectors WHERE id = ?",
            [id],
        );
        return result.affectedRows > 0;
    }
}