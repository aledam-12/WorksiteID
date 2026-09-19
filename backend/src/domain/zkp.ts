/**
 * Struttura della prova generata con il protocollo Groth16.
 * Contiene i tre elementi matematici della prova (pi_a, pi_b, pi_c)
 * e i metadati del protocollo.
 */
export interface Groth16Proof {
    /** Primo elemento della prova */
    pi_a: [string, string, string];
    /** Secondo elemento della prova */
    pi_b: [[string, string], [string, string], [string, string]];
    /** Terzo elemento della prova */
    pi_c: [string, string, string];
    /** Nome del protocollo (es. "groth16") */
    protocol: string;
    /** Curva utilizzata (es. "bn128") */
    curve: string;
}

/**
 * Segnali pubblici del circuito di verifica della patente (`license_verification.circom`).
 * Questi valori sono noti sia a chi genera la prova sia a chi la verifica.
 */
export interface ZkpPublicSignals {
    /** Commitment dello stato registrato sulla blockchain */
    commitment: string;
    /** Sfida casuale inviata dal server per evitare il riutilizzo della prova */
    challenge: string;
    /** Collegamento crittografico tra commitment, challenge e segreto del lavoratore */
    challengeBinding: string;
}

/**
 * Dati privati (witness) della patente custoditi nel wallet del lavoratore.
 * Servono per calcolare la prova ma non vengono mai inviati al verificatore.
 */
export interface LicenseZkpWitness {
    /** Saldo punti della patente (deve essere almeno 15 per accedere) */
    credits: number;
    /** Stato della patente (1 per ACTIVE, 0 per REVOKED) */
    status: number | string;
    /** Versione dello stato della patente */
    version: number;
    /** Valore segreto casuale associato a questa versione della patente */
    randomness: string;
}

/**
 * Dati inviati per richiedere la verifica dell'accesso al cantiere.
 */
export interface LicenseVerificationPayload {
    /** Identificativo anonimo della patente sulla blockchain */
    licenseRef: string;
    /** ID della challenge ricevuta dal server */
    challengeId: string;
    /** Prova a conoscenza zero Groth16 */
    proof: Groth16Proof;
    /** Segnali pubblici della prova */
    publicSignals: [string, string, string] | ZkpPublicSignals;
    /** ID del lavoratore (opzionale se già autenticato dalla sessione) */
    workerId?: string;
}

/**
 * Esito della verifica al varco.
 */
export enum VerificationOutcome {
    PASS = "PASS",
    NOT_PASS = "NOT_PASS",
}

/**
 * Risposta restituita al varco: indica solo se l'accesso è consentito o meno,
 * senza mostrare crediti o dettagli privati (Privacy by Design).
 */
export interface VerificationResult {
    /** Esito dell'accesso (PASS / NOT_PASS) */
    outcome: VerificationOutcome;
    /** Eventuale motivo del rifiuto */
    reason?: string;
}

const DECIMAL_REGEX = /^[0-9]+$/;

/**
 * Controlla che una stringa contenga un numero decimale valido per il circuito.
 */
function validateDecimalSignal(val: unknown, name: string): string {
    if (val === null || val === undefined) {
        throw new Error(`Signal '${name}' must not be null or undefined`);
    }
    const str = String(val).trim();
    if (str === "") {
        throw new Error(`Signal '${name}' must not be empty`);
    }
    if (!DECIMAL_REGEX.test(str)) {
        throw new Error(
            `Signal '${name}' must be a valid decimal string, got: ${str}`,
        );
    }
    return str;
}

/**
 * Normalizza e convalida i segnali pubblici ricevuti (come array o come oggetto).
 *
 * Nel circuito l'ordine dei segnali pubblici è:
 * 1. commitment
 * 2. challenge
 * 3. challengeBinding
 */
export function parsePublicSignals(
    signals: [string, string, string] | ZkpPublicSignals | string[],
): ZkpPublicSignals {
    if (Array.isArray(signals)) {
        if (signals.length !== 3) {
            throw new Error(
                `Public signals array must contain exactly 3 elements [commitment, challenge, challengeBinding], got ${signals.length}`,
            );
        }
        return {
            commitment: validateDecimalSignal(signals[0], "commitment"),
            challenge: validateDecimalSignal(signals[1], "challenge"),
            challengeBinding: validateDecimalSignal(signals[2], "challengeBinding"),
        };
    }

    if (signals && typeof signals === "object") {
        return {
            commitment: validateDecimalSignal(signals.commitment, "commitment"),
            challenge: validateDecimalSignal(signals.challenge, "challenge"),
            challengeBinding: validateDecimalSignal(
                signals.challengeBinding,
                "challengeBinding",
            ),
        };
    }

    throw new Error("Invalid public signals format");
}
