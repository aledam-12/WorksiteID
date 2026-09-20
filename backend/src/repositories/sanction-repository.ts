import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader, QueryError } from "mysql2/promise";
import { Sanction } from "../domain/sanction.js";

export interface SanctionRepository {
    save(sanction: Sanction): Promise<void>;
    findById(sanctionId: string): Promise<Sanction | null>;
    findByLicenseRef(licenseRef: string): Promise<Sanction[]>;
    findByInspectorRef(inspectorRef: string): Promise<Sanction[]>;
    delete(sanctionId: string): Promise<boolean>;
}

export class InMemorySanctionRepository implements SanctionRepository {
    private sanctions: Map<string, Sanction> = new Map();

    async save(sanction: Sanction): Promise<void> {
        if (this.sanctions.has(sanction.id)) {
            throw new Error("Sanction already exists");
        }
        this.sanctions.set(sanction.id, sanction);
    }

    async findById(sanctionId: string): Promise<Sanction | null> {
        return this.sanctions.get(sanctionId) ?? null;
    }

    async findByLicenseRef(licenseRef: string): Promise<Sanction[]> {
        const results: Sanction[] = [];
        for (const sanction of this.sanctions.values()) {
            if (sanction.licenseRef === licenseRef) {
                results.push(sanction);
            }
        }
        return results;
    }

    async findByInspectorRef(inspectorRef: string): Promise<Sanction[]> {
        const results: Sanction[] = [];
        for (const sanction of this.sanctions.values()) {
            if (sanction.inspectorRef === inspectorRef) {
                results.push(sanction);
            }
        }
        return results;
    }

    async delete(sanctionId: string): Promise<boolean> {
        return this.sanctions.delete(sanctionId);
    }
}

interface SanctionRow extends RowDataPacket {
    sanction_id: string;
    license_ref: string;
    penalty: number;
    reason: string;
    inspector_ref: string;
    issued_at: Date;
    randomness: string;
}

export class MySqlSanctionRepository implements SanctionRepository {
    constructor(private readonly pool: Pool) {}

    private mapRowToDomain(row: SanctionRow): Sanction {
        return new Sanction({
            id: row.sanction_id,
            licenseRef: row.license_ref,
            penalty: Number(row.penalty),
            reason: row.reason,
            inspectorRef: row.inspector_ref,
            issuedAt: new Date(row.issued_at),
            randomness: row.randomness,
        });
    }

    async save(sanction: Sanction, connection?: PoolConnection): Promise<void> {
        const executor = connection ?? this.pool;
        try {
            await executor.execute(
                `INSERT INTO private_sanctions 
                    (sanction_id, license_ref, penalty, reason, inspector_ref, issued_at, randomness)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    sanction.id,
                    sanction.licenseRef,
                    sanction.penalty,
                    sanction.reason,
                    sanction.inspectorRef,
                    sanction.issuedAt,
                    sanction.randomness,
                ],
            );
        } catch (error: unknown) {
            const dbError = error as Partial<QueryError> | undefined;
            if (dbError?.code === "ER_DUP_ENTRY") {
                throw new Error("Sanction already exists", { cause: error });
            }
            throw error;
        }
    }

    async findById(sanctionId: string, connection?: PoolConnection): Promise<Sanction | null> {
        const executor = connection ?? this.pool;
        const [rows] = await executor.execute<SanctionRow[]>(
            `SELECT sanction_id, license_ref, penalty, reason, inspector_ref, issued_at, randomness
             FROM private_sanctions
             WHERE sanction_id = ?`,
            [sanctionId],
        );

        if (rows.length === 0 || !rows[0]) {
            return null;
        }

        return this.mapRowToDomain(rows[0]);
    }

    async findByLicenseRef(licenseRef: string, connection?: PoolConnection): Promise<Sanction[]> {
        const executor = connection ?? this.pool;
        const [rows] = await executor.execute<SanctionRow[]>(
            `SELECT sanction_id, license_ref, penalty, reason, inspector_ref, issued_at, randomness
             FROM private_sanctions
             WHERE license_ref = ?
             ORDER BY issued_at DESC`,
            [licenseRef],
        );

        return rows.map((row) => this.mapRowToDomain(row));
    }

    async findByInspectorRef(inspectorRef: string, connection?: PoolConnection): Promise<Sanction[]> {
        const executor = connection ?? this.pool;
        const [rows] = await executor.execute<SanctionRow[]>(
            `SELECT sanction_id, license_ref, penalty, reason, inspector_ref, issued_at, randomness
             FROM private_sanctions
             WHERE inspector_ref = ?
             ORDER BY issued_at DESC`,
            [inspectorRef],
        );

        return rows.map((row) => this.mapRowToDomain(row));
    }

    async delete(sanctionId: string, connection?: PoolConnection): Promise<boolean> {
        const executor = connection ?? this.pool;
        const [result] = await executor.execute<ResultSetHeader>(
            "DELETE FROM private_sanctions WHERE sanction_id = ?",
            [sanctionId],
        );
        return result.affectedRows > 0;
    }
}
