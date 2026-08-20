//validazione variabli d'ambiente
const nodeEnv = (process.env.NODE_ENV || "development").toLowerCase();

const validEnv = ["development", "test", "production"];

if (!validEnv.includes(nodeEnv)) {
    throw new Error("NODE_ENV must be one of: " + validEnv.join(", "));
}

const port = Number(process.env.PORT || "3000")
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be a valid integer port number between 1 and 65535");
}

function checkString(value: string | null | undefined, name: string): string {
    if (!value || value.trim() === "") {
        throw new Error(`${name} must not be empty.`);
    }
    return value.trim();
}
const fireflyUrl = checkString(process.env.FIREFLY_API_URL, "FIREFLY_API_URL");
try {
    new URL(fireflyUrl)
} catch {
    throw new Error("FIREFLY_API_URL must be a valid URL");
}
const fireflyNamespace = checkString(process.env.FIREFLY_NAMESPACE, "FIREFLY_NAMESPACE")
const fireflyIssuerId = checkString(process.env.FIREFLY_ISSUER_ID, "FIREFLY_ISSUER_ID")
export const envConfig = {
    nodeEnv,
    port,
    fireflyUrl,
    fireflyNamespace,
    fireflyIssuerId,
}