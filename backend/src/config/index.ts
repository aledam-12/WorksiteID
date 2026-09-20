import path from "node:path";

//validazione variabli d'ambiente
const nodeEnv = (process.env.NODE_ENV || "development").toLowerCase();

const validEnv = ["development", "test", "production"];

if (!validEnv.includes(nodeEnv)) {
    throw new Error("NODE_ENV must be one of: " + validEnv.join(", "));
}

const port = Number(process.env.PORT || "3000");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid integer port number between 1 and 65535");
}

function checkString(value: string | null | undefined, name: string): string {
    if (!value || value.trim() === "") {
        throw new Error(`${name} must not be empty.`);
    }
    return value.trim();
}
// Supporta FIREFLY_URL con fallback a FIREFLY_API_URL e default di sviluppo
const fireflyUrlVarName = process.env.FIREFLY_URL !== undefined ? "FIREFLY_URL" : "FIREFLY_API_URL";
const fireflyUrlRaw = process.env.FIREFLY_URL ?? process.env.FIREFLY_API_URL ?? "http://127.0.0.1:5001";
const fireflyUrl = checkString(fireflyUrlRaw, fireflyUrlVarName);
try {
    new URL(fireflyUrl);
} catch {
    throw new Error(`${fireflyUrlVarName} must be a valid URL`);
}

const fireflyNamespaceRaw = process.env.FIREFLY_NAMESPACE ?? "default";
const fireflyNamespace = checkString(fireflyNamespaceRaw, "FIREFLY_NAMESPACE");

const fireflyIssuerId = checkString(process.env.FIREFLY_ISSUER_ID ?? "worksiteid-issuer", "FIREFLY_ISSUER_ID");

const fireflyApiNameRaw = process.env.FIREFLY_API_NAME ?? "sanction_contract";
const fireflyApiName = checkString(fireflyApiNameRaw, "FIREFLY_API_NAME");

// Percorsi per gli artifact ZKP Groth16
const defaultZkpWasmPath = path.resolve(process.cwd(), "zkp/build/license_verification_js/license_verification.wasm");
const zkpWasmPath = process.env.ZKP_WASM_PATH ?? process.env.ZKP_CIRCUIT_PATH ?? defaultZkpWasmPath;

const defaultZkpZkeyPath = path.resolve(process.cwd(), "zkp/build/license_verification_final.zkey");
const zkpZkeyPath = process.env.ZKP_ZKEY_PATH ?? defaultZkpZkeyPath;

const defaultZkpVerificationKeyPath = path.resolve(process.cwd(), "zkp/build/verification_key.json");
const zkpVerificationKeyPath = process.env.ZKP_VERIFICATION_KEY_PATH ?? defaultZkpVerificationKeyPath;

// Configurazione WebAuthn
const rpId = process.env.RP_ID ?? "localhost";
const origin = process.env.ORIGIN ?? "http://localhost:3000";

// Configurazione chiavi persistenti per l'Issuer delle Verifiable Credential
const rawPrivateKeyPath = process.env.VC_ISSUER_PRIVATE_KEY_PATH ?? process.env.ISSUER_PRIVATE_KEY_PATH;
const issuerPrivateKeyPath = rawPrivateKeyPath
    ? path.resolve(process.cwd(), rawPrivateKeyPath)
    : undefined;

const rawPublicKeyPath = process.env.VC_ISSUER_PUBLIC_KEY_PATH ?? process.env.ISSUER_PUBLIC_KEY_PATH;
const issuerPublicKeyPath = rawPublicKeyPath
    ? path.resolve(process.cwd(), rawPublicKeyPath)
    : undefined;

const issuerPrivateKeyPem = process.env.VC_ISSUER_PRIVATE_KEY_PEM ?? process.env.ISSUER_PRIVATE_KEY_PEM;
const issuerPublicKeyPem = process.env.VC_ISSUER_PUBLIC_KEY_PEM ?? process.env.ISSUER_PUBLIC_KEY_PEM;
const vcIssuerId = (process.env.VC_ISSUER_ID?.trim() || fireflyIssuerId);

// Configurazione Database MySQL
const dbHost = process.env.DB_HOST ?? "localhost";
const dbPort = Number(process.env.DB_PORT ?? "3306");
if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) {
    throw new Error("DB_PORT must be a valid integer port number between 1 and 65535");
}
const dbName = process.env.DB_NAME ?? "worksiteid";
const dbUser = process.env.DB_USER ?? "root";
const dbPassword = process.env.DB_PASSWORD ?? "";

// Configurazione License Reference Secret (HMAC-SHA256)
// Nessun default hardcoded: se in production manca, fallisce all'avvio
const licenseRefSecret = process.env.LICENSE_REF_SECRET?.trim() || undefined;
if (nodeEnv === "production" && !licenseRefSecret) {
    throw new Error("LICENSE_REF_SECRET is required in production environment");
}

export const envConfig = {
    nodeEnv,
    port,
    fireflyUrl,
    fireflyNamespace,
    fireflyIssuerId,
    fireflyApiName,
    zkpWasmPath,
    zkpZkeyPath,
    zkpVerificationKeyPath,
    issuerPrivateKeyPath,
    issuerPublicKeyPath,
    issuerPrivateKeyPem,
    issuerPublicKeyPem,
    dbHost,
    dbPort,
    dbName,
    dbUser,
    dbPassword,
    licenseRefSecret,
    vcIssuerId,
    rpId,
    origin,
};

export const config = envConfig;