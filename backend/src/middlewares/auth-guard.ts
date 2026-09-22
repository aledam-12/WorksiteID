/**
 * @file auth-guard.ts
 * @description Middleware e funzioni di guardia per l'autenticazione e il controllo degli accessi (RBAC).
 * Intercetta l'header HTTP "Authorization: Bearer <token>", valida la sessione attiva
 * e verifica i privilegi di ruolo (Worker o Inspector) per proteggere gli endpoint REST.
 *
 * @dependencies
 * - fastify: tipi FastifyRequest e FastifyReply per la gestione del ciclo richiesta/risposta HTTP.
 * - security/webauthn/session-manager.js: recupero e validazione delle sessioni attive.
 */

import { type FastifyReply, type FastifyRequest } from "fastify";
import { type SessionData, SessionManager } from "../security/webauthn/session-manager.js";

/**
 * Estrae la sessione utente corrente dalla richiesta HTTP analizzando l'header Authorization Bearer.
 *
 * @param request Richiesta HTTP Fastify in ingresso
 * @param sessionManager Gestore delle sessioni attive
 * @returns I dati di sessione dell'utente autenticato oppure null se il token è assente o scaduto
 */
export function getSessionFromRequest(
    request: FastifyRequest,
    sessionManager: SessionManager,
): SessionData | null {
    const token = sessionManager.extractBearerToken(request.headers.authorization);
    if (!token) return null;
    return sessionManager.getSession(token);
}

/**
 * Guardia di autenticazione generica.
 * Verifica che la richiesta contenga un token di sessione valido; in caso contrario risponde immediatamente con HTTP 401.
 *
 * @param request Richiesta HTTP Fastify
 * @param reply Risposta HTTP Fastify
 * @param sessionManager Gestore delle sessioni attive
 * @param customMessage Messaggio di errore personalizzato (default: "Not authenticated")
 * @returns La sessione autenticata o null (dopo aver inviato la risposta 401)
 */
export function requireAuth(
    request: FastifyRequest,
    reply: FastifyReply,
    sessionManager: SessionManager,
    customMessage: string = "Not authenticated",
): SessionData | null {
    const session = getSessionFromRequest(request, sessionManager);
    if (!session) {
        reply.status(401).send({ message: customMessage });
        return null;
    }
    return session;
}

/**
 * Guardia di autorizzazione per il ruolo "worker" (Lavoratore di cantiere).
 * Verifica che l'utente sia autenticato e che il suo ruolo applicativo sia 'worker'.
 *
 * @param request Richiesta HTTP Fastify
 * @param reply Risposta HTTP Fastify
 * @param sessionManager Gestore delle sessioni attive
 * @returns La sessione del lavoratore o null (dopo aver inviato risposta HTTP 401)
 */
export function requireWorker(
    request: FastifyRequest,
    reply: FastifyReply,
    sessionManager: SessionManager,
): SessionData | null {
    const session = getSessionFromRequest(request, sessionManager);
    if (!session || session.userType !== "worker") {
        reply.status(401).send({ message: "Worker authentication required" });
        return null;
    }
    return session;
}

/**
 * Guardia di autorizzazione per il ruolo "inspector" (Ispettore del lavoro / ASL).
 * Verifica che l'utente sia autenticato e che il suo ruolo applicativo sia 'inspector'.
 *
 * @param request Richiesta HTTP Fastify
 * @param reply Risposta HTTP Fastify
 * @param sessionManager Gestore delle sessioni attive
 * @returns La sessione dell'ispettore o null (dopo aver inviato risposta HTTP 401)
 */
export function requireInspector(
    request: FastifyRequest,
    reply: FastifyReply,
    sessionManager: SessionManager,
): SessionData | null {
    const session = getSessionFromRequest(request, sessionManager);
    if (!session || session.userType !== "inspector") {
        reply.status(401).send({ message: "Inspector authentication required" });
        return null;
    }
    return session;
}
