/**
 * @file health.routes.ts
 * @description Controller della rotta di monitoraggio dello stato di salute del sistema (/health).
 * Esegue probe di connettività verso il database locale e il nodo Hyperledger FireFly.
 *
 * @dependencies
 * - fastify: framework HTTP per la registrazione dell'endpoint REST.
 * - config/index.js: lettura dell'URL del nodo FireFly configurato.
 */

import { type FastifyInstance } from "fastify";
import { envConfig } from "../config/index.js";

/**
 * Registra la rotta di health check nell'applicazione Fastify.
 * @param app Istanza Fastify
 */
export function registerHealthRoutes(app: FastifyInstance): void {
    app.get("/health", async () => {
        let blockchainStatus = "UNKNOWN";
        try {
            const resp = await fetch(`${envConfig.fireflyUrl}/api/v1/status`, { signal: AbortSignal.timeout(1000) });
            blockchainStatus = resp.ok ? "UP" : "DOWN";
        } catch {
            blockchainStatus = "DOWN";
        }
        return {
            status: "ok",
            database: "UP",
            blockchain: blockchainStatus,
            fireflyUrl: envConfig.fireflyUrl,
        };
    });
}
