import {
    ChallengeServiceImpl,
} from "../../../backend/src/services/challenge-service.js";
import {
    InvalidChallengeError,
    ReplayedChallengeError,
} from "../../../backend/src/domain/zkp-errors.js";

const BN128_SCALAR_FIELD = BigInt(
    "21888242871839275222246405745257275088548364400416034343698204186575808495617",
);

describe("ChallengeService", () => {
    let service: ChallengeServiceImpl;

    beforeEach(() => {
        service = new ChallengeServiceImpl();
    });

    describe("createChallenge", () => {
        it("should generate a valid challenge with UUID, workerId, licenseRef and CSPRNG decimal string", async () => {
            const record = await service.createChallenge("WRK-001", "LIC-001");

            expect(record.id).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            );
            expect(record.challenge).toMatch(/^[0-9]+$/);
            expect(record.workerId).toBe("WRK-001");
            expect(record.licenseRef).toBe("LIC-001");
            expect(record.used).toBe(false);

            // Field element fits within bn128 scalar field
            const val = BigInt(record.challenge);
            expect(val).toBeGreaterThan(0n);
            expect(val).toBeLessThan(BN128_SCALAR_FIELD);
        });

        it("should reject empty or missing workerId or licenseRef", async () => {
            await expect(
                service.createChallenge("", "LIC-001"),
            ).rejects.toThrow("Worker ID must not be empty");
            await expect(
                service.createChallenge("   ", "LIC-001"),
            ).rejects.toThrow("Worker ID must not be empty");
            await expect(
                service.createChallenge("WRK-001", ""),
            ).rejects.toThrow("License reference must not be empty");
            await expect(
                service.createChallenge("WRK-001", "   "),
            ).rejects.toThrow("License reference must not be empty");
        });

        it("should replace and delete the old challenge if worker requests a new one", async () => {
            const c1 = await service.createChallenge("WRK-001", "LIC-001");
            expect(await service.getChallenge(c1.id)).not.toBeNull();

            // Request a new challenge for the same worker
            const c2 = await service.createChallenge("WRK-001", "LIC-001");
            expect(c2.id).not.toBe(c1.id);

            // Old challenge should be deleted
            expect(await service.getChallenge(c1.id)).toBeNull();
            await expect(
                service.validateChallenge(c1.id, "WRK-001", "LIC-001"),
            ).rejects.toThrow(InvalidChallengeError);

            // New challenge should be active and valid
            const active = await service.getChallenge(c2.id);
            expect(active).not.toBeNull();
            expect(active?.id).toBe(c2.id);
            await expect(
                service.validateChallenge(c2.id, "WRK-001", "LIC-001"),
            ).resolves.toBeDefined();
        });

        it("should allow multiple distinct workers to have active challenges simultaneously", async () => {
            const c1 = await service.createChallenge("WRK-001", "LIC-001");
            const c2 = await service.createChallenge("WRK-002", "LIC-002");

            expect(c1.id).not.toBe(c2.id);
            expect(await service.getChallenge(c1.id)).not.toBeNull();
            expect(await service.getChallenge(c2.id)).not.toBeNull();

            await expect(
                service.validateChallenge(c1.id, "WRK-001", "LIC-001"),
            ).resolves.toBeDefined();
            await expect(
                service.validateChallenge(c2.id, "WRK-002", "LIC-002"),
            ).resolves.toBeDefined();
        });
    });

    describe("getChallenge", () => {
        it("should retrieve an existing challenge", async () => {
            const created = await service.createChallenge("WRK-001", "LIC-001");
            const retrieved = await service.getChallenge(created.id);

            expect(retrieved).not.toBeNull();
            expect(retrieved?.id).toBe(created.id);
            expect(retrieved?.challenge).toBe(created.challenge);
            expect(retrieved?.workerId).toBe("WRK-001");
            expect(retrieved?.licenseRef).toBe("LIC-001");
        });

        it("should return null for non-existent or empty challenge ID", async () => {
            expect(await service.getChallenge("non-existent-id")).toBeNull();
            expect(await service.getChallenge("")).toBeNull();
            expect(await service.getChallenge("   ")).toBeNull();
        });

        it("should return a clone so modifications do not affect internal state", async () => {
            const created = await service.createChallenge("WRK-001", "LIC-001");
            const retrieved = await service.getChallenge(created.id);
            if (retrieved) {
                retrieved.used = true;
            }

            const fresh = await service.getChallenge(created.id);
            expect(fresh?.used).toBe(false);
        });
    });

    describe("validateChallenge", () => {
        it("should validate a challenge with matching worker and license without expiring", async () => {
            const created = await service.createChallenge("WRK-001", "LIC-001");
            const validated = await service.validateChallenge(
                created.id,
                "WRK-001",
                "LIC-001",
            );

            expect(validated.id).toBe(created.id);
            expect(validated.used).toBe(false);
        });

        it("should validate when expectedValue matches", async () => {
            const created = await service.createChallenge("WRK-001", "LIC-001");
            const validated = await service.validateChallenge(
                created.id,
                "WRK-001",
                "LIC-001",
                created.challenge,
            );

            expect(validated.challenge).toBe(created.challenge);
        });

        it("should reject when workerId does not match the challenge owner", async () => {
            const created = await service.createChallenge("WRK-001", "LIC-001");
            await expect(
                service.validateChallenge(created.id, "WRK-OTHER", "LIC-001"),
            ).rejects.toThrow("Challenge does not belong to worker: WRK-OTHER");
        });

        it("should reject when licenseRef does not match the challenge license", async () => {
            const created = await service.createChallenge("WRK-001", "LIC-001");
            await expect(
                service.validateChallenge(created.id, "WRK-001", "LIC-OTHER"),
            ).rejects.toThrow(
                "Challenge was not issued for license: LIC-OTHER",
            );
        });

        it("should reject when expectedValue does not match", async () => {
            const created = await service.createChallenge("WRK-001", "LIC-001");
            await expect(
                service.validateChallenge(
                    created.id,
                    "WRK-001",
                    "LIC-001",
                    "99999999999999",
                ),
            ).rejects.toThrow(InvalidChallengeError);
        });

        it("should throw InvalidChallengeError on empty or non-existent challenge ID", async () => {
            await expect(service.validateChallenge("")).rejects.toThrow(
                InvalidChallengeError,
            );
            await expect(service.validateChallenge("  ")).rejects.toThrow(
                InvalidChallengeError,
            );
            await expect(
                service.validateChallenge("unknown-id"),
            ).rejects.toThrow(InvalidChallengeError);
        });

        it("should throw ReplayedChallengeError if challenge has already been used", async () => {
            const created = await service.createChallenge("WRK-001", "LIC-001");
            await service.consumeChallenge(created.id);

            await expect(
                service.validateChallenge(created.id),
            ).rejects.toThrow(ReplayedChallengeError);
        });
    });

    describe("consumeChallenge", () => {
        it("should mark the challenge as used", async () => {
            const created = await service.createChallenge("WRK-001", "LIC-001");
            await service.consumeChallenge(created.id);

            const record = await service.getChallenge(created.id);
            expect(record?.used).toBe(true);
        });

        it("should throw ReplayedChallengeError when attempting to consume twice", async () => {
            const created = await service.createChallenge("WRK-001", "LIC-001");
            await service.consumeChallenge(created.id);

            await expect(
                service.consumeChallenge(created.id),
            ).rejects.toThrow(ReplayedChallengeError);
        });

        it("should throw InvalidChallengeError on empty or non-existent ID", async () => {
            await expect(service.consumeChallenge("")).rejects.toThrow(
                InvalidChallengeError,
            );
            await expect(
                service.consumeChallenge("not-found"),
            ).rejects.toThrow(InvalidChallengeError);
        });
    });
});
