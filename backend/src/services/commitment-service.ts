import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export type CommitmentState = Record<string, unknown>;

export interface CommitmentService {
    /**
     * Generates cryptographically secure randomness.
     * @param byteLength Number of random bytes (defaults to 32 bytes / 256 bits).
     * @returns Hex-encoded string of the random bytes.
     */
    generateRandomness(byteLength?: number): string;

    /**
     * Builds a deterministic canonical string representation of the state.
     * Ensures keys are sorted recursively, arrays and primitives are uniformly serialized.
     * @param state The state object or value to canonicalize.
     * @returns Deterministic JSON string.
     */
    canonicalize(state: unknown): string;

    /**
     * Calculates the cryptographic commitment C = SHA-256(canonicalize({ state, randomness })).
     *
     * Canonical encoding / preimage combination:
     * 1. Structured canonical representation: `preimage = canonicalize({ state, randomness })`.
     *    Ensures deterministic serialization with recursively sorted keys for both top-level and inner state.
     * 2. Hash computation: `SHA-256(preimage)` encoded as a 64-character lowercase hex string.
     *
     * @param state The state object containing the commitment data.
     * @param randomness The cryptographically secure randomness.
     * @returns Hex-encoded SHA-256 hash.
     */
    createCommitment(state: CommitmentState, randomness: string): string;

    /**
     * Verifies if a given commitment matches the state and randomness.
     * Uses timingSafeEqual to protect against timing attacks.
     * @param state The state object.
     * @param randomness The randomness string.
     * @param commitment The candidate commitment hex string.
     * @returns True if the commitment is valid, false otherwise.
     */
    verifyCommitment(
        state: CommitmentState,
        randomness: string,
        commitment: string,
    ): boolean;
}

export class CommitmentServiceImpl implements CommitmentService {
    generateRandomness(byteLength: number = 32): string {
        if (!Number.isInteger(byteLength) || byteLength <= 0) {
            throw new Error("Byte length must be a positive integer");
        }
        return randomBytes(byteLength).toString("hex");
    }

    canonicalize(state: unknown): string {
        return this.serializeCanonical(state, new Set<object>());
    }

    private serializeCanonical(value: unknown, seen: Set<object>): string {
        if (value === null) {
            return "null";
        }

        if (typeof value === "boolean") {
            return value ? "true" : "false";
        }

        if (typeof value === "number") {
            if (!Number.isFinite(value)) {
                throw new Error("Cannot canonicalize non-finite number");
            }
            return Object.is(value, -0) ? "0" : JSON.stringify(value);
        }

        if (typeof value === "string") {
            return JSON.stringify(value);
        }

        if (value instanceof Date) {
            return JSON.stringify(value.toISOString());
        }

        if (Array.isArray(value)) {
            if (seen.has(value)) {
                throw new Error("Circular reference detected during canonicalization");
            }
            seen.add(value);
            const items = value.map((item) =>
                item === undefined ? "null" : this.serializeCanonical(item, seen),
            );
            seen.delete(value);
            return `[${items.join(",")}]`;
        }

        if (typeof value === "object") {
            if (seen.has(value)) {
                throw new Error("Circular reference detected during canonicalization");
            }
            seen.add(value);

            const record = value as Record<string, unknown>;
            const keys = Object.keys(record).sort();
            const entries: string[] = [];

            for (const key of keys) {
                const propVal = record[key];
                if (
                    propVal === undefined ||
                    typeof propVal === "function" ||
                    typeof propVal === "symbol"
                ) {
                    continue;
                }
                entries.push(
                    `${JSON.stringify(key)}:${this.serializeCanonical(propVal, seen)}`,
                );
            }

            seen.delete(value);
            return `{${entries.join(",")}}`;
        }

        throw new Error(`Unsupported value type: ${typeof value}`);
    }

    createCommitment(state: CommitmentState, randomness: string): string {
        if (!state || typeof state !== "object" || Array.isArray(state)) {
            throw new Error("State must be a non-null object");
        }

        if (
            !randomness ||
            typeof randomness !== "string" ||
            randomness.trim() === ""
        ) {
            throw new Error("Randomness must not be empty");
        }

        // 1. Structured canonical encoding of state + randomness
        const preimage = this.canonicalize({
            state,
            randomness,
        });

        // 2. Compute SHA-256 hash
        const hash = createHash("sha256");
        hash.update(preimage, "utf8");
        return hash.digest("hex");
    }

    verifyCommitment(
        state: CommitmentState,
        randomness: string,
        commitment: string,
    ): boolean {
        if (
            !commitment ||
            typeof commitment !== "string" ||
            commitment.trim() === ""
        ) {
            return false;
        }

        try {
            const expectedCommitment = this.createCommitment(state, randomness);
            const normalizedActual = commitment.trim().toLowerCase();

            if (
                normalizedActual.length !== expectedCommitment.length ||
                !/^[0-9a-f]{64}$/.test(normalizedActual)
            ) {
                return false;
            }

            const expectedBuffer = Buffer.from(expectedCommitment, "hex");
            const actualBuffer = Buffer.from(normalizedActual, "hex");

            return timingSafeEqual(expectedBuffer, actualBuffer);
        } catch {
            return false;
        }
    }
}
