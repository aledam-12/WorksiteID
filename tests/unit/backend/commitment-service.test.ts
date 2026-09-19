import {
    CommitmentService,
    CommitmentServiceImpl,
} from "../../../backend/src/services/commitment-service.js";
import { LicenseStatusEnum } from "../../../backend/src/domain/license.js";

describe("CommitmentService (Poseidon)", () => {
    let commitmentService: CommitmentService;

    // bn128 curve scalar field prime: p = 21888242871839275222246405745257275088548364400416034343698204186575808495617
    const BN128_FIELD_PRIME = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

    beforeEach(() => {
        commitmentService = new CommitmentServiceImpl();
    });

    describe("generateRandomness", () => {
        it("should generate a valid CSPRNG decimal string fitting within bn128 scalar field", () => {
            const randomness = commitmentService.generateRandomness();

            expect(typeof randomness).toBe("string");
            expect(randomness).toMatch(/^[0-9]+$/);

            const randBigInt = BigInt(randomness);
            expect(randBigInt).toBeGreaterThan(0n);
            expect(randBigInt).toBeLessThan(BN128_FIELD_PRIME);
        });

        it("should generate different randomness on subsequent calls", () => {
            const r1 = commitmentService.generateRandomness();
            const r2 = commitmentService.generateRandomness();

            expect(r1).not.toBe(r2);
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

    describe("createCommitment (Poseidon)", () => {
        it("should match the Circom Poseidon commitment bit-for-bit with test vectors", async () => {
            // Test vector used in Circom witness calculation and license-verification.json:
            // credits: 30, status: 1 (ACTIVE), version: 1, randomness: 123456789
            const expectedCommitment =
                "19183109381518206312794836465842399593219837414581162645845819618634038672702";

            const state = {
                credits: 30,
                status: LicenseStatusEnum.ACTIVE,
                version: 1,
            };

            const commitment = await commitmentService.createCommitment(
                state,
                "123456789",
            );

            expect(commitment).toBe(expectedCommitment);
        });

        it("should accept status as numeric or enum string", async () => {
            const stateEnum = {
                credits: 30,
                status: LicenseStatusEnum.ACTIVE,
                version: 1,
            };

            const stateNumeric = {
                credits: 30,
                status: 1,
                version: 1,
            };

            const cEnum = await commitmentService.createCommitment(stateEnum, "123456789");
            const cNum = await commitmentService.createCommitment(stateNumeric, "123456789");

            expect(cEnum).toBe(cNum);
        });

        it("should produce different commitments when credits change", async () => {
            const randomness = "987654321";
            const stateA = { credits: 30, status: "ACTIVE", version: 1 };
            const stateB = { credits: 25, status: "ACTIVE", version: 1 };

            const cA = await commitmentService.createCommitment(stateA, randomness);
            const cB = await commitmentService.createCommitment(stateB, randomness);

            expect(cA).not.toBe(cB);
        });

        it("should produce different commitments when status changes", async () => {
            const randomness = "987654321";
            const stateA = { credits: 30, status: "ACTIVE", version: 1 };
            const stateB = { credits: 30, status: "REVOKED", version: 1 };

            const cA = await commitmentService.createCommitment(stateA, randomness);
            const cB = await commitmentService.createCommitment(stateB, randomness);

            expect(cA).not.toBe(cB);
        });

        it("should produce different commitments when version changes", async () => {
            const randomness = "987654321";
            const stateA = { credits: 30, status: "ACTIVE", version: 1 };
            const stateB = { credits: 30, status: "ACTIVE", version: 2 };

            const cA = await commitmentService.createCommitment(stateA, randomness);
            const cB = await commitmentService.createCommitment(stateB, randomness);

            expect(cA).not.toBe(cB);
        });

        it("should produce different commitments when randomness changes", async () => {
            const state = { credits: 30, status: "ACTIVE", version: 1 };

            const cA = await commitmentService.createCommitment(state, "111111111");
            const cB = await commitmentService.createCommitment(state, "222222222");

            expect(cA).not.toBe(cB);
        });

        it("should reject invalid inputs", async () => {
            await expect(
                commitmentService.createCommitment(null as unknown as Record<string, unknown>, "123"),
            ).rejects.toThrow("State must be a non-null object");

            await expect(
                commitmentService.createCommitment({ credits: 30, status: "ACTIVE" } as unknown as Record<string, unknown>, "123"),
            ).rejects.toThrow("State must include version");

            await expect(
                commitmentService.createCommitment({ credits: 30, version: 1 } as unknown as Record<string, unknown>, "123"),
            ).rejects.toThrow("State must include status");

            await expect(
                commitmentService.createCommitment({ status: "ACTIVE", version: 1 } as unknown as Record<string, unknown>, "123"),
            ).rejects.toThrow("State must include credits");

            await expect(
                commitmentService.createCommitment({ credits: 30, status: "ACTIVE", version: 1 }, ""),
            ).rejects.toThrow("Randomness must not be empty");
        });
    });

    describe("verifyCommitment", () => {
        it("should return true when commitment matches state and randomness", async () => {
            const state = { credits: 30, status: "ACTIVE", version: 1 };
            const randomness = "123456789";
            const commitment = await commitmentService.createCommitment(state, randomness);

            const isValid = await commitmentService.verifyCommitment(state, randomness, commitment);
            expect(isValid).toBe(true);
        });

        it("should return false when commitment does not match", async () => {
            const state = { credits: 30, status: "ACTIVE", version: 1 };
            const randomness = "123456789";
            const commitment = await commitmentService.createCommitment(state, randomness);

            // Mismatched state
            expect(
                await commitmentService.verifyCommitment(
                    { credits: 20, status: "ACTIVE", version: 1 },
                    randomness,
                    commitment,
                ),
            ).toBe(false);

            // Mismatched randomness
            expect(
                await commitmentService.verifyCommitment(state, "999999", commitment),
            ).toBe(false);

            // Corrupted commitment string
            expect(
                await commitmentService.verifyCommitment(state, randomness, "9999999999999"),
            ).toBe(false);

            // Empty commitment
            expect(
                await commitmentService.verifyCommitment(state, randomness, ""),
            ).toBe(false);
        });
    });
});
