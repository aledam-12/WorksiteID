/**
 * @file firefly.client.ts
 * @description Client HTTP standard per interagire con l'istanza locale di Hyperledger FireFly.
 * Espone metodi per l'invocazione di transazioni con conferma (invoke) e l'interrogazione
 * in sola lettura dello stato del ledger (query).
 *
 * @dependencies
 * - config/index.js: configurazione dell'URL, namespace e nome API di FireFly.
 */

import { envConfig } from "../../config/index.js";

/**
 * Errore generico di interazione con il gateway FireFly.
 */
export class FireFlyError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "FireFlyError";
    }
}

/**
 * Errore sollevato quando il servizio FireFly non è raggiungibile in rete.
 */
export class FireFlyConnectionError extends FireFlyError {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "FireFlyConnectionError";
    }
}

/**
 * Errore sollevato quando FireFly risponde con uno status code HTTP di errore (>= 400).
 */
export class FireFlyHttpError extends FireFlyError {
    readonly statusCode: number;
    readonly responseBody: unknown;

    constructor(
        message: string,
        statusCode: number,
        responseBody?: unknown,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = "FireFlyHttpError";
        this.statusCode = statusCode;
        this.responseBody = responseBody;
    }
}

/**
 * Errore sollevato quando il payload restituito da FireFly non è un JSON valido.
 */
export class FireFlyResponseError extends FireFlyError {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "FireFlyResponseError";
    }
}

/**
 * Parametri di configurazione del client FireFly.
 */
export interface FireFlyClientConfig {
    /** URL di base del server FireFly (es. http://127.0.0.1:5001) */
    baseUrl: string;
    /** Namespace dell'ambiente Fabric (default "default") */
    namespace?: string;
    /** Nome dell'API FFI esposta (default "sanctionsv2.0") */
    apiName?: string;
    /** Funzione fetch personalizzabile per testing */
    fetchFn?: typeof fetch;
}

/**
 * Contratto del client FireFly per le operazioni sul chaincode.
 */
export interface FireFlyClient {
    /**
     * Invia una transazione di scrittura sul ledger con conferma di commit.
     * @param method Nome del metodo del chaincode da invocare
     * @param input Parametri di input per la transazione
     */
    invoke<T = unknown>(method: string, input: unknown): Promise<T>;

    /**
     * Esegue una lettura (query) dello stato del ledger senza generare transazioni di blocco.
     * @param method Nome del metodo di query del chaincode
     * @param input Parametri di input per la query
     */
    query<T = unknown>(method: string, input: unknown): Promise<T>;
}

/**
 * Implementazione concreta di FireFlyClient tramite fetch HTTP.
 */
export class FireFlyClientImpl implements FireFlyClient {
    readonly #baseUrl: string;
    readonly #namespace: string;
    readonly #apiName: string;
    readonly #fetchFn: typeof fetch;

    constructor(config?: Partial<FireFlyClientConfig>) {
        const rawUrl = config?.baseUrl ?? envConfig.fireflyUrl;
        if (!rawUrl || rawUrl.trim() === "") {
            throw new FireFlyError("FireFly baseUrl must not be empty");
        }
        try {
            new URL(rawUrl.trim());
        } catch (err) {
            throw new FireFlyError("FireFly baseUrl must be a valid URL", { cause: err });
        }

        this.#baseUrl = rawUrl.trim().replace(/\/+$/, "");
        this.#namespace = (config?.namespace ?? envConfig.fireflyNamespace ?? "default").trim();
        this.#apiName = (config?.apiName ?? envConfig.fireflyApiName ?? "sanctionsv2.0").trim();
        this.#fetchFn = config?.fetchFn ?? globalThis.fetch.bind(globalThis);
    }

    get baseUrl(): string {
        return this.#baseUrl;
    }

    get namespace(): string {
        return this.#namespace;
    }

    get apiName(): string {
        return this.#apiName;
    }

    /**
     * Invia richiesta POST a /invoke/{method}?confirm=true per confermare la transazione on-chain.
     */
    async invoke<T = unknown>(method: string, input: unknown): Promise<T> {
        this.#validateMethod(method);
        const url = `${this.#baseUrl}/api/v1/namespaces/${encodeURIComponent(this.#namespace)}/apis/${encodeURIComponent(this.#apiName)}/invoke/${encodeURIComponent(method)}?confirm=true`;
        return this.#sendRequest<T>(url, input);
    }

    /**
     * Invia richiesta POST a /query/{method} per interrogare lo stato corrente del chaincode.
     */
    async query<T = unknown>(method: string, input: unknown): Promise<T> {
        this.#validateMethod(method);
        const url = `${this.#baseUrl}/api/v1/namespaces/${encodeURIComponent(this.#namespace)}/apis/${encodeURIComponent(this.#apiName)}/query/${encodeURIComponent(method)}`;
        return this.#sendRequest<T>(url, input);
    }

    #validateMethod(method: string): void {
        if (!method || method.trim() === "") {
            throw new FireFlyError("Method name must not be empty");
        }
    }

    async #sendRequest<T>(url: string, input: unknown): Promise<T> {
        const requestBody = JSON.stringify({ input: input ?? {} });

        let response: Response;
        try {
            response = await this.#fetchFn(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: requestBody,
            });
        } catch (error) {
            throw new FireFlyConnectionError(
                `Failed to connect to FireFly at ${url}: ${(error as Error).message}`,
                { cause: error },
            );
        }

        if (!response.ok) {
            let errorBody: unknown;
            let rawText = "";
            try {
                rawText = await response.text();
                errorBody = rawText ? JSON.parse(rawText) : null;
            } catch {
                errorBody = rawText;
            }

            const message = this.#extractErrorMessage(errorBody, response.status, response.statusText);
            throw new FireFlyHttpError(message, response.status, errorBody);
        }

        if (response.status === 204) {
            return undefined as T;
        }

        const responseText = await response.text();
        if (!responseText || responseText.trim() === "") {
            return undefined as T;
        }

        try {
            return JSON.parse(responseText) as T;
        } catch (error) {
            throw new FireFlyResponseError(
                `Invalid JSON response received from FireFly: ${(error as Error).message}`,
                { cause: error },
            );
        }
    }

    #extractErrorMessage(errorBody: unknown, status: number, statusText: string): string {
        if (errorBody && typeof errorBody === "object") {
            const record = errorBody as Record<string, unknown>;
            if (typeof record.error === "string" && record.error.trim() !== "") {
                return record.error.trim();
            }
            if (typeof record.message === "string" && record.message.trim() !== "") {
                return record.message.trim();
            }
            if (typeof record.errorMessage === "string" && record.errorMessage.trim() !== "") {
                return record.errorMessage.trim();
            }
        }
        if (typeof errorBody === "string" && errorBody.trim() !== "") {
            return errorBody.trim();
        }
        return `FireFly request failed with HTTP ${status}: ${statusText || "Unknown Error"}`;
    }
}
