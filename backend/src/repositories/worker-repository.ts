import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader, QueryError } from "mysql2/promise";
import { Worker } from "../domain/worker.js";

export interface WorkerRepository {
    register(worker: Worker): Promise<void>;
    findById(id: string): Promise<Worker | null>;
    existsById(id: string): Promise<boolean>;
    findByCf?(cf: string): Promise<Worker | null>;
    delete?(id: string): Promise<boolean>;
}

export class InMemoryWorkerRepository implements WorkerRepository {
    private workers: Map<string, Worker> = new Map();

    async register(worker: Worker): Promise<void> {
        if (await this.existsById(worker.id)) {
            throw new Error("Worker already exists");
        }
        for (const existing of this.workers.values()) {
            if (existing.cf === worker.cf) {
                throw new Error("Worker with this CF already exists");
            }
        }
        this.workers.set(worker.id, worker);
    }

    async findById(id: string): Promise<Worker | null> {
        return this.workers.get(id) ?? null;
    }

    async existsById(id: string): Promise<boolean> {
        return this.workers.has(id);
    }

    async findByCf(cf: string): Promise<Worker | null> {
        for (const worker of this.workers.values()) {
            if (worker.cf === cf) {
                return worker;
            }
        }
        return null;
    }

    async delete(id: string): Promise<boolean> {
        return this.workers.delete(id);
    }
}

interface WorkerRow extends RowDataPacket {
    id: string;
    name: string;
    surname: string;
    cf: string;
    company: string;
}

export class MySqlWorkerRepository implements WorkerRepository {
    constructor(private readonly pool: Pool) {}

    async register(worker: Worker, connection?: PoolConnection): Promise<void> {
        const executor = connection ?? this.pool;
        try {
            await executor.execute(
                "INSERT INTO workers (id, name, surname, cf, company) VALUES (?, ?, ?, ?, ?)",
                [worker.id, worker.name, worker.surname, worker.cf, worker.company],
            );
        } catch (error: unknown) {
            const dbError = error as Partial<QueryError> | undefined;
            if (dbError?.code === "ER_DUP_ENTRY") {
                if (dbError.message?.includes("uq_workers_cf") || dbError.message?.includes("cf")) {
                    throw new Error("Worker with this CF already exists", { cause: error });
                }
                throw new Error("Worker already exists", { cause: error });
            }
            throw error;
        }
    }

    async findById(id: string, connection?: PoolConnection): Promise<Worker | null> {
        const executor = connection ?? this.pool;
        const [rows] = await executor.execute<WorkerRow[]>(
            "SELECT id, name, surname, cf, company FROM workers WHERE id = ?",
            [id],
        );

        if (rows.length === 0 || !rows[0]) {
            return null;
        }

        const row = rows[0];
        return new Worker({
            id: row.id,
            name: row.name,
            surname: row.surname,
            cf: row.cf,
            company: row.company,
        });
    }

    async existsById(id: string, connection?: PoolConnection): Promise<boolean> {
        const executor = connection ?? this.pool;
        const [rows] = await executor.execute<RowDataPacket[]>(
            "SELECT 1 FROM workers WHERE id = ? LIMIT 1",
            [id],
        );
        return rows.length > 0;
    }

    async findByCf(cf: string, connection?: PoolConnection): Promise<Worker | null> {
        const executor = connection ?? this.pool;
        const [rows] = await executor.execute<WorkerRow[]>(
            "SELECT id, name, surname, cf, company FROM workers WHERE cf = ?",
            [cf],
        );

        if (rows.length === 0 || !rows[0]) {
            return null;
        }

        const row = rows[0];
        return new Worker({
            id: row.id,
            name: row.name,
            surname: row.surname,
            cf: row.cf,
            company: row.company,
        });
    }

    async delete(id: string, connection?: PoolConnection): Promise<boolean> {
        const executor = connection ?? this.pool;
        const [result] = await executor.execute<ResultSetHeader>(
            "DELETE FROM workers WHERE id = ?",
            [id],
        );
        return result.affectedRows > 0;
    }
}