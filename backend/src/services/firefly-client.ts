import { envConfig } from "../config/index.js";

export class FireFlyError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "FireFlyError";
    }
}

export class FireFlyConnectionError extends FireFlyError {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "FireFlyConnectionError";
    }
}

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

export class FireFlyResponseError extends FireFlyError {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "FireFlyResponseError";
    }
}

export interface FireFlyClientConfig {
    baseUrl: string;
    namespace?: string;
    apiName?: string;
    fetchFn?: typeof fetch;
}

export interface FireFlyClient {
    invoke<T = unknown>(method: string, input: unknown): Promise<T>;
    query<T = unknown>(method: string, input: unknown): Promise<T>;
}

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

    async invoke<T = unknown>(method: string, input: unknown): Promise<T> {
        this.#validateMethod(method);
        const url = `${this.#baseUrl}/api/v1/namespaces/${encodeURIComponent(this.#namespace)}/apis/${encodeURIComponent(this.#apiName)}/invoke/${encodeURIComponent(method)}?confirm=true`;
        return this.#sendRequest<T>(url, input);
    }

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