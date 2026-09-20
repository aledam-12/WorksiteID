import mysql from "mysql2/promise";
import { config } from "../config/index.js";

export interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password?: string;
    connectionLimit?: number;
}

let activePool: mysql.Pool | null = null;

/**
 * Creates and initializes a MySQL connection pool using mysql2/promise.
 */
export function createDatabasePool(override?: Partial<DatabaseConfig>): mysql.Pool {
    const dbConfig: DatabaseConfig = {
        host: override?.host ?? config.dbHost,
        port: override?.port ?? config.dbPort,
        database: override?.database ?? config.dbName,
        user: override?.user ?? config.dbUser,
        password: override?.password ?? config.dbPassword,
        connectionLimit: override?.connectionLimit ?? 10,
    };

    const poolOptions: mysql.PoolOptions = {
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
        waitForConnections: true,
        connectionLimit: dbConfig.connectionLimit ?? 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
    };
    if (dbConfig.password) {
        poolOptions.password = dbConfig.password;
    }

    const pool = mysql.createPool(poolOptions);

    activePool = pool;
    return pool;
}

/**
 * Retrieves the currently active connection pool, or creates one if not initialized.
 */
export function getDatabasePool(): mysql.Pool {
    if (!activePool) {
        activePool = createDatabasePool();
    }
    return activePool;
}

/**
 * Closes the active database connection pool.
 */
export async function closeDatabasePool(): Promise<void> {
    if (activePool) {
        await activePool.end();
        activePool = null;
    }
}

/**
 * Pings the database connection to verify connectivity.
 */
export async function pingDatabase(pool: mysql.Pool = getDatabasePool()): Promise<boolean> {
    try {
        const conn = await pool.getConnection();
        try {
            await conn.ping();
            return true;
        } finally {
            conn.release();
        }
    } catch {
        return false;
    }
}

/**
 * Executes a callback within a managed database transaction.
 * Automatically handles commit on success, rollback on error, and connection release.
 */
export async function withTransaction<T>(
    poolOrConn: mysql.Pool | mysql.PoolConnection,
    callback: (conn: mysql.PoolConnection) => Promise<T>,
): Promise<T> {
    let conn: mysql.PoolConnection;
    let shouldRelease = false;

    if ("getConnection" in poolOrConn) {
        conn = await poolOrConn.getConnection();
        shouldRelease = true;
    } else {
        conn = poolOrConn;
    }

    try {
        await conn.beginTransaction();
        const result = await callback(conn);
        await conn.commit();
        return result;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        if (shouldRelease) {
            conn.release();
        }
    }
}
