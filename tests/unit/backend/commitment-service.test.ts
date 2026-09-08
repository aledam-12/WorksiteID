import { createHash } from "node:crypto";
import {
    CommitmentService,
    CommitmentServiceImpl,
} from "../../../backend/src/services/commitment-service.js";

describe("CommitmentService", () => {
    let commitmentService: CommitmentService;

    beforeEach(() => {
        commitmentService = new CommitmentServiceImpl();
    });

    describe("generateRandomness", () => {
        it("should generate non-empty and sufficiently long randomness", () => {
            const randomness = commitmentService.generateRandomness();

            expect(typeof randomness).toBe("string");
            expect(randomness.length).toBeGreaterThanOrEqual(32);
            // Default 32 bytes -> 64 hex characters
            expect(randomness).toHaveLength(64);
            expect(randomness).toMatch(/^[0-9a-f]+$/);
        });

        it("should generate different randomness on subsequent calls", () => {
            const r1 = commitmentService.generateRandomness();
            const r2 = commitmentService.generateRandomness();

            expect(r1).not.toBe(r2);
        });

        it("should allow custom byte lengths", () => {
            const r16 = commitmentService.generateRandomness(16);
            expect(r16).toHaveLength(32);

            const r64 = commitmentService.generateRandomness(64);
            expect(r64).toHaveLength(128);
        });

        it("should reject non-positive byte lengths", () => {
            expect(() => commitmentService.generateRandomness(0)).toThrow(
                "Byte length must be a positive integer",
            );
            expect(() => commitmentService.generateRandomness(-1)).toThrow(
                "Byte length must be a positive integer",
            );
        });
    });

    describe("canonical encoding", () => {
        it("should deterministically encode objects regardless of key order", () => {
            const stateA = {
                licenseId: "LIC-001",
                credits: 30,
                status: "ACTIVE",
            };
            const stateB = {
                status: "ACTIVE",
                credits: 30,
                licenseId: "LIC-001",
            };

            const encodedA = commitmentService.canonicalize(stateA);
            const encodedB = commitmentService.canonicalize(stateB);

            expect(encodedA).toBe(encodedB);
            expect(encodedA).toBe(
                '{"credits":30,"licenseId":"LIC-001","status":"ACTIVE"}',
            );
        });

        it("should deterministically encode nested objects with different key order", () => {
            const stateA = {
                id: "LIC-001",
                metadata: {
                    issuer: "Authority-A",
                    version: 1,
                },
            };
            const stateB = {
                metadata: {
                    version: 1,
                    issuer: "Authority-A",
                },
                id: "LIC-001",
            };

            const encodedA = commitmentService.canonicalize(stateA);
            const encodedB = commitmentService.canonicalize(stateB);

            expect(encodedA).toBe(encodedB);
            expect(encodedA).toBe(
                '{"id":"LIC-001","metadata":{"issuer":"Authority-A","version":1}}',
            );
        });

        it("should preserve array elements order while canonicalizing objects inside", () => {
            const state = {
                items: [
                    { b: 2, a: 1 },
                    { d: 4, c: 3 },
                ],
            };

            const encoded = commitmentService.canonicalize(state);
            expect(encoded).toBe('{"items":[{"a":1,"b":2},{"c":3,"d":4}]}');
        });

        it("should correctly handle primitives, null, and booleans", () => {
            expect(commitmentService.canonicalize(null)).toBe("null");
            expect(commitmentService.canonicalize(true)).toBe("true");
            expect(commitmentService.canonicalize(false)).toBe("false");
            expect(commitmentService.canonicalize(42)).toBe("42");
            expect(commitmentService.canonicalize(-0)).toBe("0");
            expect(commitmentService.canonicalize("hello")).toBe('"hello"');
        });

        it("should ignore undefined properties in objects", () => {
            const stateA = { a: 1, b: undefined };
            const stateB = { a: 1 };

            expect(commitmentService.canonicalize(stateA)).toBe(
                commitmentService.canonicalize(stateB),
            );
        });

        it("should reject circular references", () => {
            const circular: Record<string, unknown> = { a: 1 };
            circular.self = circular;

            expect(() => commitmentService.canonicalize(circular)).toThrow(
                "Circular reference detected during canonicalization",
            );
        });

        it("should reject non-finite numbers", () => {
            expect(() => commitmentService.canonicalize(NaN)).toThrow(
                "Cannot canonicalize non-finite number",
            );
            expect(() => commitmentService.canonicalize(Infinity)).toThrow(
                "Cannot canonicalize non-finite number",
            );
        });

        it("should reject bigint values as unsupported", () => {
            expect(() => commitmentService.canonicalize(10n)).toThrow(
                "Unsupported value type: bigint",
            );
            expect(() =>
                commitmentService.canonicalize({ amount: 10n }),
            ).toThrow("Unsupported value type: bigint");
        });
    });

    describe("createCommitment", () => {
        const baseState = {
            licenseId: "LIC-100",
            credits: 30,
        };

        it("should produce the same commitment for same state and same randomness", () => {
            const randomness = commitmentService.generateRandomness();

            const c1 = commitmentService.createCommitment(baseState, randomness);
            const c2 = commitmentService.createCommitment(baseState, randomness);

            expect(c1).toBe(c2);
            expect(c1).toHaveLength(64);
            expect(c1).toMatch(/^[0-9a-f]{64}$/);
        });

        it("should produce different commitments for same state and different randomness", () => {
            const r1 = commitmentService.generateRandomness();
            const r2 = commitmentService.generateRandomness();

            const c1 = commitmentService.createCommitment(baseState, r1);
            const c2 = commitmentService.createCommitment(baseState, r2);

            expect(c1).not.toBe(c2);
        });

        it("should produce different commitments for different state and same randomness", () => {
            const randomness = commitmentService.generateRandomness();
            const differentState = {
                licenseId: "LIC-100",
                credits: 25,
            };

            const c1 = commitmentService.createCommitment(baseState, randomness);
            const c2 = commitmentService.createCommitment(differentState, randomness);

            expect(c1).not.toBe(c2);
        });

        it("should produce the same commitment regardless of state property ordering", () => {
            const randomness = commitmentService.generateRandomness();
            const state1 = { licenseId: "LIC-100", credits: 30 };
            const state2 = { credits: 30, licenseId: "LIC-100" };

            const c1 = commitmentService.createCommitment(state1, randomness);
            const c2 = commitmentService.createCommitment(state2, randomness);

            expect(c1).toBe(c2);
        });

        it("should compute commitment explicitly matching SHA-256(canonicalize({ state, randomness }))", () => {
            const randomness = commitmentService.generateRandomness();
            const expectedPreimage = commitmentService.canonicalize({
                state: baseState,
                randomness,
            });
            const expectedCommitment = createHash("sha256")
                .update(expectedPreimage, "utf8")
                .digest("hex");

            const actualCommitment = commitmentService.createCommitment(
                baseState,
                randomness,
            );

            expect(actualCommitment).toBe(expectedCommitment);
        });

        it("should throw an error if state is invalid", () => {
            const randomness = commitmentService.generateRandomness();

            expect(() =>
                commitmentService.createCommitment(null as unknown as Record<string, unknown>, randomness),
            ).toThrow("State must be a non-null object");

            expect(() =>
                commitmentService.createCommitment([] as unknown as Record<string, unknown>, randomness),
            ).toThrow("State must be a non-null object");
        });

        it("should throw an error if randomness is empty or not a string", () => {
            expect(() =>
                commitmentService.createCommitment(baseState, ""),
            ).toThrow("Randomness must not be empty");

            expect(() =>
                commitmentService.createCommitment(baseState, "   "),
            ).toThrow("Randomness must not be empty");

            expect(() =>
                commitmentService.createCommitment(baseState, null as unknown as string),
            ).toThrow("Randomness must not be empty");
        });
    });

    describe("verifyCommitment", () => {
        const state = {
            licenseId: "LIC-200",
            credits: 20,
        };

        it("should return true for a correct commitment", () => {
            const randomness = commitmentService.generateRandomness();
            const commitment = commitmentService.createCommitment(state, randomness);

            const isValid = commitmentService.verifyCommitment(
                state,
                randomness,
                commitment,
            );

            expect(isValid).toBe(true);
        });

        it("should return true for an uppercase valid commitment", () => {
            const randomness = commitmentService.generateRandomness();
            const commitment = commitmentService.createCommitment(state, randomness);

            const isValid = commitmentService.verifyCommitment(
                state,
                randomness,
                commitment.toUpperCase(),
            );

            expect(isValid).toBe(true);
        });

        it("should return false for a modified commitment", () => {
            const randomness = commitmentService.generateRandomness();
            const commitment = commitmentService.createCommitment(state, randomness);

            // Flip the last character to tamper the commitment
            const lastChar = commitment.slice(-1);
            const tamperedLastChar = lastChar === "0" ? "1" : "0";
            const tamperedCommitment =
                commitment.slice(0, -1) + tamperedLastChar;

            const isValid = commitmentService.verifyCommitment(
                state,
                randomness,
                tamperedCommitment,
            );

            expect(isValid).toBe(false);
        });

        it("should return false if state is modified", () => {
            const randomness = commitmentService.generateRandomness();
            const commitment = commitmentService.createCommitment(state, randomness);
            const modifiedState = { ...state, credits: 15 };

            const isValid = commitmentService.verifyCommitment(
                modifiedState,
                randomness,
                commitment,
            );

            expect(isValid).toBe(false);
        });

        it("should return false if randomness is modified", () => {
            const randomness = commitmentService.generateRandomness();
            const commitment = commitmentService.createCommitment(state, randomness);
            const tamperedRandomness = commitmentService.generateRandomness();

            const isValid = commitmentService.verifyCommitment(
                state,
                tamperedRandomness,
                commitment,
            );

            expect(isValid).toBe(false);
        });

        it("should return false for malformed or empty commitments", () => {
            const randomness = commitmentService.generateRandomness();

            expect(
                commitmentService.verifyCommitment(state, randomness, ""),
            ).toBe(false);
            expect(
                commitmentService.verifyCommitment(state, randomness, "invalid-hex"),
            ).toBe(false);
            expect(
                commitmentService.verifyCommitment(state, randomness, "abc"),
            ).toBe(false);
            expect(
                commitmentService.verifyCommitment(
                    state,
                    randomness,
                    null as unknown as string,
                ),
            ).toBe(false);
        });
    });
});
