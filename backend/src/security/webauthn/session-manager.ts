/**
 * @file session-manager.ts
 * @description Gestore in-memory delle sessioni utente autenticate e delle sfide WebAuthn temporanee.
 * Fornisce isolamento della memoria per i token Bearer, gestione del TTL (Time-To-Live)
 * per registrazioni e login passkey ed estrazione sicura degli header di autorizzazione.
 *
 * @dependencies
 * - node:crypto: generazione di identificativi casuali UUID per le sessioni.
 */

import crypto from "node:crypto";

/**
 * Dati del profilo utente associati a una sessione attiva.
 */
export interface SessionData {
    /** Identificativo univoco dell'utente (WRK-... o INSP-...) */
    userId: string;
    /** Ruolo applicativo dell'utente */
    userType: "worker" | "inspector";
    /** Nome anagrafico */
    name: string;
    /** Cognome anagrafico */
    surname: string;
    /** Denominazione dell'impresa o dell'ente ispettivo */
    company?: string | undefined;
    /** Codice Fiscale (se lavoratore) */
    cf?: string | undefined;
}

/**
 * Stato temporaneo di una registrazione WebAuthn in corso prima della verifica finale.
 */
export interface PendingRegistration {
    /** ID della registrazione temporanea */
    id: string;
    /** ID assegnato all'utente da creare */
    workerId: string;
    name: string;
    surname: string;
    cf: string;
    company: string;
    userType: "worker" | "inspector";
    /** Challenge casuale inviata al client per la firma */
    challenge: string;
    /** Timestamp di creazione in millisecondi */
    createdAt: number;
}

/**
 * Dati temporanei della challenge di login.
 */
interface AuthChallengeData {
    challenge: string;
    createdAt: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minuti

/**
 * Classe per la gestione centralizzata delle sessioni e delle challenge FIDO2 con TTL.
 */
export class SessionManager {
    private readonly sessions = new Map<string, SessionData>();
    private readonly pendingRegistrations = new Map<string, PendingRegistration>();
    private readonly authChallenges = new Map<string, AuthChallengeData>();
    private readonly ttlMs: number;

    constructor(ttlMs: number = DEFAULT_TTL_MS) {
        this.ttlMs = ttlMs;
    }

    /**
     * Crea una nuova sessione autenticata generando un token UUID univoco.
     * @param data Dati del profilo dell'utente autenticato
     * @returns Token di sessione restituito al client
     */
    createSession(data: SessionData): string {
        const sessionId = crypto.randomUUID();
        this.sessions.set(sessionId, { ...data });
        return sessionId;
    }

    /**
     * Recupera i dati della sessione associati a un token.
     * @param token Token di sessione Bearer
     */
    getSession(token: string): SessionData | null {
        if (!token) return null;
        return this.sessions.get(token) ?? null;
    }

    /**
     * Elimina una sessione attiva (logout).
     * @param token Token di sessione da revocare
     */
    deleteSession(token: string): boolean {
        return this.sessions.delete(token);
    }

    /**
     * Memorizza i dati temporanei della registrazione in attesa della firma biometrica.
     */
    savePendingRegistration(id: string, data: Omit<PendingRegistration, "id" | "createdAt">): PendingRegistration {
        const record: PendingRegistration = {
            id,
            ...data,
            createdAt: Date.now(),
        };
        this.pendingRegistrations.set(id, record);
        return record;
    }

    /**
     * Recupera una registrazione pendente verificando che non sia scaduto il TTL.
     */
    getPendingRegistration(id: string): PendingRegistration | null {
        const record = this.pendingRegistrations.get(id);
        if (!record) return null;
        if (Date.now() - record.createdAt > this.ttlMs) {
            this.pendingRegistrations.delete(id);
            return null;
        }
        return record;
    }

    /**
     * Rimuove la registrazione pendente al termine del processo o in caso di errore.
     */
    deletePendingRegistration(id: string): void {
        this.pendingRegistrations.delete(id);
    }

    /**
     * Memorizza una challenge di autenticazione login associata a una sessione di verifica.
     */
    saveAuthChallenge(id: string, challenge: string): void {
        this.authChallenges.set(id, {
            challenge,
            createdAt: Date.now(),
        });
    }

    /**
     * Recupera la challenge di login verificando la validità temporale del TTL.
     */
    getAuthChallenge(id: string): string | null {
        const record = this.authChallenges.get(id);
        if (!record) return null;
        if (Date.now() - record.createdAt > this.ttlMs) {
            this.authChallenges.delete(id);
            return null;
        }
        return record.challenge;
    }

    /**
     * Preleva e rimuove atomicamente la challenge di login per prevenire attacchi replay.
     */
    consumeAuthChallenge(id: string): string | null {
        const challenge = this.getAuthChallenge(id);
        this.authChallenges.delete(id);
        return challenge;
    }

    /**
     * Estrae la stringa del token dall'header HTTP "Authorization: Bearer <token>".
     * @param authHeader Valore grezzo dell'header Authorization
     */
    extractBearerToken(authHeader?: string): string | null {
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        const token = authHeader.substring("Bearer ".length).trim();
        return token || null;
    }
}
