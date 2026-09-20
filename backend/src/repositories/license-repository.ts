import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader, QueryError } from "mysql2/promise";
import { PrivateLicenseState } from "../domain/private-license-state.js";
import { LicenseStatusEnum } from "../domain/license.js";

export interface LicenseRepository {
    save(license: PrivateLicenseState): Promise<void>;
    create(license: PrivateLicenseState): Promise<void>;
    findById(licenseId: string): Promise<PrivateLicenseState | null>;
    findByLicenseId(licenseId: string): Promise<PrivateLicenseState | null>;
    findByWorkerId(workerId: string): Promise<PrivateLicenseState | null>;
    findByLicenseRef(licenseRef: string): Promise<PrivateLicenseState | null>;
    update(license: PrivateLicenseState): Promise<void>;
    updateState(license: PrivateLicenseState): Promise<void>;
    delete(licenseId: string): Promise<boolean>;
}

export class InMemoryLicenseRepository implements LicenseRepository {
    private licenses: Map<string, PrivateLicenseState> = new Map();

    async save(license: PrivateLicenseState): Promise<void> {
        if (this.licenses.has(license.licenseId)) {
            throw new Error("License already exists");
        }
        for (const existing of this.licenses.values()) {
            if (license.workerId && existing.workerId === license.workerId) {
                throw new Error("Worker already has a license");
            }
            if (license.licenseRef && existing.licenseRef === license.licenseRef) {
                throw new Error("License ref already exists");
            }
        }
        this.licenses.set(license.licenseId, license);
    }

    async create(license: PrivateLicenseState): Promise<void> {
        return this.save(license);
    }

    async findById(licenseId: string): Promise<PrivateLicenseState | null> {
        return this.findByLicenseId(licenseId);
    }

    async findByLicenseId(licenseId: string): Promise<PrivateLicenseState | null> {
        return this.licenses.get(licenseId) ?? null;
    }

    async findByWorkerId(workerId: string): Promise<PrivateLicenseState | null> {
        for (const license of this.licenses.values()) {
            if (license.workerId === workerId) {
                return license;
            }
        }
        return null;
    }

    async findByLicenseRef(licenseRef: string): Promise<PrivateLicenseState | null> {
        for (const license of this.licenses.values()) {
            if (license.licenseRef === licenseRef) {
                return license;
            }
        }
        return null;
    }

    async update(license: PrivateLicenseState): Promise<void> {
        if (!this.licenses.has(license.licenseId)) {
            throw new Error("License not found");
        }
        this.licenses.set(license.licenseId, license);
    }

    async updateState(license: PrivateLicenseState): Promise<void> {
        return this.update(license);
    }

    async delete(licenseId: string): Promise<boolean> {
        return this.licenses.delete(licenseId);
    }
}

interface LicenseRow extends RowDataPacket {
    license_id: string;
    worker_id: string;
    license_ref: string;
    credits: number;
    status: "ACTIVE" | "REVOKED";
    randomness: string;
    version: number;
    created_at: Date;
    updated_at: Date;
}

export class MySqlLicenseRepository implements LicenseRepository {
    constructor(private readonly pool: Pool) {}

    private mapRowToDomain(row: LicenseRow): PrivateLicenseState {
        return new PrivateLicenseState(
            row.license_id,
            Number(row.credits),
            row.status === "ACTIVE" ? LicenseStatusEnum.ACTIVE : LicenseStatusEnum.REVOKED,
            row.randomness,
            Number(row.version),
            row.worker_id,
            row.license_ref,
            row.created_at ? new Date(row.created_at) : undefined,
            row.updated_at ? new Date(row.updated_at) : undefined,
        );
    }

    async save(license: PrivateLicenseState, connection?: PoolConnection): Promise<void> {
        const executor = connection ?? this.pool;
        if (!license.workerId) {
            throw new Error("workerId is required to save a private license");
        }
        if (!license.licenseRef) {
            throw new Error("licenseRef is required to save a private license");
        }

        try {
            await executor.execute(
                `INSERT INTO private_licenses 
                    (license_id, worker_id, license_ref, credits, status, randomness, version, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    license.licenseId,
                    license.workerId,
                    license.licenseRef,
                    license.credits,
                    license.status,
                    license.randomness,
                    license.version,
                    license.createdAt ?? new Date(),
                    license.updatedAt ?? new Date(),
                ],
            );
        } catch (error: unknown) {
            const dbError = error as Partial<QueryError> | undefined;
            if (dbError?.code === "ER_DUP_ENTRY") {
                if (dbError.message?.includes("uq_private_licenses_worker") || dbError.message?.includes("worker_id")) {
                    throw new Error("Worker already has a license", { cause: error });
                }
                if (dbError.message?.includes("uq_private_licenses_ref") || dbError.message?.includes("license_ref")) {
                    throw new Error("License ref already exists", { cause: error });
                }
                throw new Error("License already exists", { cause: error });
            }
            throw error;
        }
    }

    async create(license: PrivateLicenseState, connection?: PoolConnection): Promise<void> {
        return this.save(license, connection);
    }

    async findById(licenseId: string, connection?: PoolConnection): Promise<PrivateLicenseState | null> {
        return this.findByLicenseId(licenseId, connection);
    }

    async findByLicenseId(licenseId: string, connection?: PoolConnection): Promise<PrivateLicenseState | null> {
        const executor = connection ?? this.pool;
        const [rows] = await executor.execute<LicenseRow[]>(
            `SELECT license_id, worker_id, license_ref, credits, status, randomness, version, created_at, updated_at
             FROM private_licenses
             WHERE license_id = ?`,
            [licenseId],
        );

        if (rows.length === 0 || !rows[0]) {
            return null;
        }

        return this.mapRowToDomain(rows[0]);
    }

    async findByWorkerId(workerId: string, connection?: PoolConnection): Promise<PrivateLicenseState | null> {
        const executor = connection ?? this.pool;
        const [rows] = await executor.execute<LicenseRow[]>(
            `SELECT license_id, worker_id, license_ref, credits, status, randomness, version, created_at, updated_at
             FROM private_licenses
             WHERE worker_id = ?`,
            [workerId],
        );

        if (rows.length === 0 || !rows[0]) {
            return null;
        }

        return this.mapRowToDomain(rows[0]);
    }

    async findByLicenseRef(licenseRef: string, connection?: PoolConnection): Promise<PrivateLicenseState | null> {
        const executor = connection ?? this.pool;
        const [rows] = await executor.execute<LicenseRow[]>(
            `SELECT license_id, worker_id, license_ref, credits, status, randomness, version, created_at, updated_at
             FROM private_licenses
             WHERE license_ref = ?`,
            [licenseRef],
        );

        if (rows.length === 0 || !rows[0]) {
            return null;
        }

        return this.mapRowToDomain(rows[0]);
    }

    async update(license: PrivateLicenseState, connection?: PoolConnection): Promise<void> {
        const executor = connection ?? this.pool;
        const [result] = await executor.execute<ResultSetHeader>(
            `UPDATE private_licenses
             SET credits = ?, status = ?, randomness = ?, version = ?, updated_at = CURRENT_TIMESTAMP
             WHERE license_id = ?`,
            [
                license.credits,
                license.status,
                license.randomness,
                license.version,
                license.licenseId,
            ],
        );

        if (result.affectedRows === 0) {
            throw new Error("License not found");
        }
    }

    async updateState(license: PrivateLicenseState, connection?: PoolConnection): Promise<void> {
        return this.update(license, connection);
    }

    async delete(licenseId: string, connection?: PoolConnection): Promise<boolean> {
        const executor = connection ?? this.pool;
        const [result] = await executor.execute<ResultSetHeader>(
            "DELETE FROM private_licenses WHERE license_id = ?",
            [licenseId],
        );
        return result.affectedRows > 0;
    }
}
