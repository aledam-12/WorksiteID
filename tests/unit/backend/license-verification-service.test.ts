import { LicenseVerificationServiceImpl } from "../../../backend/src/services/license-verification-service.js";
import { BlockchainService } from "../../../backend/src/services/blockchain-service.js";
import { ZkpService } from "../../../backend/src/services/zkp-service.js";
import {
    ChallengeService,
    VerificationChallenge,
} from "../../../backend/src/services/challenge-service.js";
import {
    Groth16Proof,
    LicenseVerificationPayload,
    VerificationOutcome,
} from "../../../backend/src/domain/zkp.js";
import {
    InvalidChallengeError,
    ReplayedChallengeError,
} from "../../../backend/src/domain/zkp-errors.js";
import { LicenseOnChain } from "../../../backend/src/domain/license-on-chain.js";

describe("LicenseVerificationService", () => {
    let blockchainService: jest.Mocked<BlockchainService>;
    let zkpService: jest.Mocked<ZkpService>;
    let challengeService: jest.Mocked<ChallengeService>;
    let service: LicenseVerificationServiceImpl;

    const mockProof: Groth16Proof = {
        pi_a: ["1", "2", "3"],
        pi_b: [
            ["4", "5"],
            ["6", "7"],
            ["8", "9"],
        ],
        pi_c: ["10", "11", "12"],
        protocol: "groth16",
        curve: "bn128",
    };

    const validCommitment =
        "19183109381518206312794836465842399593219837414581162645845819618634038672702";
    const validChallenge = "42";
    const validChallengeBinding =
        "9047283310314213407419999991371225318842033956114860120480342502187493595546";

    const validPayload: LicenseVerificationPayload = {
        workerId: "WRK-001",
        licenseRef: "LIC-001",
        challengeId: "test-challenge-uuid",
        proof: mockProof,
        publicSignals: [validCommitment, validChallenge, validChallengeBinding],
    };

    const mockOnChainState = new LicenseOnChain(
        "LIC-001",
        validCommitment,
        1,
    );

    beforeEach(() => {
        blockchainService = {
            createLicense: jest.fn(),
            getLicenseState: jest.fn().mockResolvedValue(mockOnChainState),
            issueSanction: jest.fn(),
            getSanction: jest.fn(),
        };

        zkpService = {
            computeCommitment: jest.fn(),
            computeChallengeBinding: jest.fn(),
            generateProof: jest.fn(),
            verifyProof: jest.fn().mockResolvedValue(true),
        };

        const mockChallengeRecord: VerificationChallenge = {
            id: "test-challenge-uuid",
            challenge: validChallenge,
            workerId: "WRK-001",
            licenseRef: "LIC-001",
            used: false,
        };

        challengeService = {
            createChallenge: jest.fn(),
            getChallenge: jest.fn().mockResolvedValue(mockChallengeRecord),
            validateChallenge: jest.fn().mockResolvedValue(mockChallengeRecord),
            consumeChallenge: jest.fn().mockResolvedValue(undefined),
        };

        service = new LicenseVerificationServiceImpl(
            blockchainService,
            zkpService,
            challengeService,
        );
    });

    describe("Verifica con successo (PASS)", () => {
        it("should return PASS and consume challenge when proof, signals, worker and license match", async () => {
            const result = await service.verifyLicenseAccess(validPayload);

            expect(result.outcome).toBe(VerificationOutcome.PASS);
            expect(result.reason).toBeUndefined();

            // Verify challenge was validated with workerId, licenseRef and then consumed
            expect(challengeService.validateChallenge).toHaveBeenCalledWith(
                "test-challenge-uuid",
                "WRK-001",
                "LIC-001",
                validChallenge,
            );
            expect(blockchainService.getLicenseState).toHaveBeenCalledWith("LIC-001");
            expect(zkpService.verifyProof).toHaveBeenCalledWith(
                mockProof,
                {
                    commitment: validCommitment,
                    challenge: validChallenge,
                    challengeBinding: validChallengeBinding,
                },
            );
            expect(challengeService.consumeChallenge).toHaveBeenCalledWith("test-challenge-uuid");
        });

        it("should accept authenticatedWorkerId passed as parameter", async () => {
            const payloadWithoutWorkerId = { ...validPayload };
            delete payloadWithoutWorkerId.workerId;

            const result = await service.verifyLicenseAccess(
                payloadWithoutWorkerId,
                "WRK-001",
            );
            expect(result.outcome).toBe(VerificationOutcome.PASS);
            expect(challengeService.validateChallenge).toHaveBeenCalledWith(
                "test-challenge-uuid",
                "WRK-001",
                "LIC-001",
                validChallenge,
            );
        });

        it("should work when publicSignals is passed as an object", async () => {
            const payloadWithObjectSignals: LicenseVerificationPayload = {
                ...validPayload,
                publicSignals: {
                    commitment: validCommitment,
                    challenge: validChallenge,
                    challengeBinding: validChallengeBinding,
                },
            };

            const result = await service.verifyLicenseAccess(payloadWithObjectSignals);
            expect(result.outcome).toBe(VerificationOutcome.PASS);
            expect(challengeService.consumeChallenge).toHaveBeenCalledWith("test-challenge-uuid");
        });

        it("should never expose private credits, witness, or randomness in result", async () => {
            const result = await service.verifyLicenseAccess(validPayload);

            expect(result).not.toHaveProperty("credits");
            expect(result).not.toHaveProperty("randomness");
            expect(result).not.toHaveProperty("witness");
            expect(Object.keys(result)).toEqual(["outcome"]);
        });
    });

    describe("Binding Utente, Challenge e Patente", () => {
        it("should return NOT_PASS when workerId is missing from both payload and parameter", async () => {
            const payloadWithoutWorker = { ...validPayload };
            delete payloadWithoutWorker.workerId;

            const result = await service.verifyLicenseAccess(payloadWithoutWorker);
            expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
            expect(result.reason).toContain("Authenticated worker ID is required");
            expect(challengeService.validateChallenge).not.toHaveBeenCalled();
        });

        it("should return NOT_PASS when Worker A tries to use Worker B's challenge", async () => {
            challengeService.validateChallenge.mockRejectedValue(
                new InvalidChallengeError(
                    "Challenge does not belong to worker: WRK-002",
                ),
            );

            // Worker B (WRK-002) attempts to use the payload with Worker A's challenge
            const result = await service.verifyLicenseAccess(validPayload, "WRK-002");
            expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
            expect(result.reason).toContain("does not belong to worker");
            expect(challengeService.consumeChallenge).not.toHaveBeenCalled();
        });

        it("should return NOT_PASS when challenge was issued for a different licenseRef", async () => {
            challengeService.validateChallenge.mockRejectedValue(
                new InvalidChallengeError(
                    "Challenge was not issued for license: LIC-999",
                ),
            );

            const payloadDifferentLicense: LicenseVerificationPayload = {
                ...validPayload,
                licenseRef: "LIC-999",
            };

            const result = await service.verifyLicenseAccess(payloadDifferentLicense);
            expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
            expect(result.reason).toContain("not issued for license");
            expect(challengeService.consumeChallenge).not.toHaveBeenCalled();
        });
    });

    describe("Payload non valido", () => {
        it("should return NOT_PASS when payload is null or undefined", async () => {
            const result = await service.verifyLicenseAccess(
                null as unknown as LicenseVerificationPayload,
            );
            expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
            expect(result.reason).toContain("Invalid verification payload");
            expect(challengeService.consumeChallenge).not.toHaveBeenCalled();
        });

        it("should return NOT_PASS when licenseRef is missing or empty", async () => {
            const result = await service.verifyLicenseAccess({
                ...validPayload,
                licenseRef: "",
            });
            expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
            expect(result.reason).toContain("License reference is required");
            expect(challengeService.consumeChallenge).not.toHaveBeenCalled();
        });

        it("should return NOT_PASS when challengeId is missing or empty", async () => {
            const result = await service.verifyLicenseAccess({
                ...validPayload,
                challengeId: "  ",
            });
            expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
            expect(result.reason).toContain("Challenge ID is required");
            expect(challengeService.consumeChallenge).not.toHaveBeenCalled();
        });

        it("should return NOT_PASS when publicSignals format has fewer than 3 elements", async () => {
            const result = await service.verifyLicenseAccess({
                ...validPayload,
                publicSignals: ["123", "456"] as unknown as [
                    string,
                    string,
                    string,
                ],
            });
            expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
            expect(result.reason).toContain("exactly 3 elements");
            expect(challengeService.consumeChallenge).not.toHaveBeenCalled();
        });

        it("should return NOT_PASS when publicSignals format has more than 3 elements", async () => {
            const result = await service.verifyLicenseAccess({
                ...validPayload,
                publicSignals: ["123", "456", "789", "999"] as unknown as [
                    string,
                    string,
                    string,
                ],
            });
            expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
            expect(result.reason).toContain("exactly 3 elements");
            expect(challengeService.consumeChallenge).not.toHaveBeenCalled();
        });

        it("should return NOT_PASS when publicSignals contain non-decimal characters", async () => {
            const result = await service.verifyLicenseAccess({
                ...validPayload,
                publicSignals: ["12345", "not-a-number", "67890"],
            });
            expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
            expect(result.reason).toContain("must be a valid decimal string");
            expect(challengeService.consumeChallenge).not.toHaveBeenCalled();
        });
    });

    describe("Validazione Challenge (Anti-replay e Scadenza)", () => {
        it("should return NOT_PASS when challenge does not exist", async () => {
            challengeService.validateChallenge.mockRejectedValue(
                new InvalidChallengeError("Challenge not found: unknown-id"),
            );

            const result = await service.verifyLicenseAccess(validPayload);
            expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
            expect(result.reason).toContain("Challenge not found");
            expect(challengeService.consumeChallenge).not.toHaveBeenCalled();
        });

        it("should return NOT_PASS and prevent replay when challenge has already been used", async () => {
            challengeService.validateChallenge.mockRejectedValue(
                new ReplayedChallengeError(
                    "Challenge has already been used: test-challenge-uuid",
                ),
            );

            const result = await service.verifyLicenseAccess(validPayload);
            expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
            expect(result.reason).toContain("already been used");
            expect(challengeService.consumeChallenge).not.toHaveBeenCalled();
        });

        it("should return NOT_PASS when consumeChallenge fails on concurrent replay without unhandled throw", async () => {
            challengeService.consumeChallenge.mockRejectedValue(
                new ReplayedChallengeError(
                    "Challenge has already been used: test-challenge-uuid",
                ),
            );

            const result = await service.verifyLicenseAccess(validPayload);
            expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
            expect(result.reason).toContain("already been used");
        });

        it("should return NOT_PASS when challenge value in proof does not match server challenge", async () => {
            challengeService.validateChallenge.mockRejectedValue(
                new InvalidChallengeError(
                    "Challenge value does not match expected challenge",
                ),
            );

            const result = await service.verifyLicenseAccess(validPayload);
            expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
            expect(result.reason).toContain("does not match expected challenge");
            expect(challengeService.consumeChallenge).not.toHaveBeenCalled();
        });
    });

    describe("Coerenza con la Blockchain", () => {
        it("should return NOT_PASS when license is not found on ledger", async () => {
            blockchainService.getLicenseState.mockResolvedValue(null);

            const result = await service.verifyLicenseAccess(validPayload);
            expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
            expect(result.reason).toContain("License not found on ledger");
            expect(challengeService.consumeChallenge).not.toHaveBeenCalled();
        });

        it("should return NOT_PASS when blockchain service throws an error", async () => {
            blockchainService.getLicenseState.mockRejectedValue(
                new Error("Ledger connection timeout"),
            );

            const result = await service.verifyLicenseAccess(validPayload);
            expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
            expect(result.reason).toContain("Blockchain retrieval error");
            expect(challengeService.consumeChallenge).not.toHaveBeenCalled();
        });

        it("should return NOT_PASS when proof commitment differs from on-chain commitment", async () => {
            const differentCommitmentState = new LicenseOnChain(
                "LIC-001",
                "99999999999999999999999999999999999999999999999999999999999999999999999999999",
                2,
            );
            blockchainService.getLicenseState.mockResolvedValue(
                differentCommitmentState,
            );

            const result = await service.verifyLicenseAccess(validPayload);
            expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
            expect(result.reason).toContain("Commitment mismatch");
            expect(challengeService.consumeChallenge).not.toHaveBeenCalled();
            expect(zkpService.verifyProof).not.toHaveBeenCalled();
        });
    });

    describe("Verifica Crittografica Proof Groth16", () => {
        it("should return NOT_PASS and NOT consume challenge when verifyProof returns false", async () => {
            zkpService.verifyProof.mockResolvedValue(false);

            const result = await service.verifyLicenseAccess(validPayload);
            expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
            expect(result.reason).toContain("Invalid Groth16 proof");
            expect(challengeService.consumeChallenge).not.toHaveBeenCalled();
        });
    });
});
