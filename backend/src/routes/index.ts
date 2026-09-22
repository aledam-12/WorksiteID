/**
 * @file index.ts
 * @description Modulo radice per la registrazione aggregata di tutti i controller REST dell'applicazione.
 * Collega e registra in Fastify le rotte per /health, /api/auth/*, /api/worker/*, /api/inspector/* e /api/public/credential/*.
 *
 * @dependencies
 * - fastify: framework HTTP principale.
 * - routes/*: controller individuali modulari.
 */

import { type FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health.routes.js";
import { registerAuthRoutes, type AuthRoutesContext } from "./auth.routes.js";
import { registerWorkerRoutes, type WorkerRoutesContext } from "./worker.routes.js";
import { registerInspectorRoutes, type InspectorRoutesContext } from "./inspector.routes.js";
import { registerCredentialRoutes, type CredentialRoutesContext } from "./credential.routes.js";

/**
 * Contesto unificato di tutti i repository e servizi richiesti dalle rotte applicative.
 */
export type AllRoutesContext = AuthRoutesContext &
    WorkerRoutesContext &
    InspectorRoutesContext &
    CredentialRoutesContext;

/**
 * Registra in sequenza tutti i router dell'applicazione nell'istanza Fastify.
 * @param app Istanza del server Fastify
 * @param ctx Contesto contenente tutte le dipendenze
 */
export function registerAllRoutes(app: FastifyInstance, ctx: AllRoutesContext): void {
    registerHealthRoutes(app);
    registerAuthRoutes(app, ctx);
    registerWorkerRoutes(app, ctx);
    registerInspectorRoutes(app, ctx);
    registerCredentialRoutes(app, ctx);
}

export * from "./health.routes.js";
export * from "./auth.routes.js";
export * from "./worker.routes.js";
export * from "./inspector.routes.js";
export * from "./credential.routes.js";
