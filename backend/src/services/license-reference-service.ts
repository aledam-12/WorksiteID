import crypto from "node:crypto";
import { config } from "../config/index.js";

export class LicenseReferenceService {
    readonly #secret: string;

    constructor(secret?: string) {
        const resolvedSecret = secret ?? config.licenseRefSecret;
        if (!resolvedSecret || typeof resolvedSecret !== "string" || resolvedSecret.trim() === "") {
            throw new Error("LICENSE_REF_SECRET is required and cannot be empty");
        }
        this.#secret = resolvedSecret;
    }

    /**
     * Generates a deterministic pseudonymous licenseRef from a raw licenseId.
     * Computes HMAC-SHA256(secret, licenseId.trim()) and returns lowercase hex digest.
     */
    generateLicenseRef(licenseId: string): string {
        if (!licenseId || typeof licenseId !== "string" || licenseId.trim() === "") {
            throw new Error("licenseId is required and cannot be empty");
        }
        return crypto
            .createHmac("sha256", this.#secret)
            .update(licenseId.trim())
            .digest("hex");
    }

    /**
     * Securely verifies a provided licenseRef against the expected HMAC-SHA256 digest
     * using crypto.timingSafeEqual on byte Buffers.
     */
    verifyLicenseRef(licenseId: string, licenseRef: string): boolean {
        if (!licenseId || typeof licenseId !== "string" || licenseId.trim() === "") {
            return false;
        }
        if (!licenseRef || typeof licenseRef !== "string" || licenseRef.trim() === "") {
            return false;
        }

        const expected = this.generateLicenseRef(licenseId);
        const expectedBuf = Buffer.from(expected, "utf-8");
        const providedBuf = Buffer.from(licenseRef.trim().toLowerCase(), "utf-8");

        if (expectedBuf.length !== providedBuf.length) {
            return false;
        }

        return crypto.timingSafeEqual(expectedBuf, providedBuf);
    }
}
