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
const zkpWasmPath = process.env.ZKP_WASM_PATH ?? defaultZkpWasmPath;

const defaultZkpZkeyPath = path.resolve(process.cwd(), "zkp/build/license_verification_final.zkey");
const zkpZkeyPath = process.env.ZKP_ZKEY_PATH ?? defaultZkpZkeyPath;

const defaultZkpVerificationKeyPath = path.resolve(process.cwd(), "zkp/build/verification_key.json");
const zkpVerificationKeyPath = process.env.ZKP_VERIFICATION_KEY_PATH ?? defaultZkpVerificationKeyPath;

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
};