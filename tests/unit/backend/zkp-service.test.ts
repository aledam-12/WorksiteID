import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ZkpServiceImpl } from "../../../backend/src/services/zkp-service.js";
import { LicenseStatusEnum } from "../../../backend/src/domain/license.js";
import { Groth16Proof, LicenseZkpWitness } from "../../../backend/src/domain/zkp.js";
import { ZkpConfigError } from "../../../backend/src/domain/zkp-errors.js";

const TEST_COMMITMENT =
    "19183109381518206312794836465842399593219837414581162645845819618634038672702";
const TEST_CHALLENGE = "42";
const TEST_CHALLENGE_BINDING =
    "9047283310314213407419999991371225318842033956114860120480342502187493595546";
const TEST_RANDOMNESS = "123456789";

describe("ZkpService", () => {
    let zkpService: ZkpServiceImpl;
    let validProof: Groth16Proof;
    let validSignals: [string, string, string];

    beforeAll(async () => {
        zkpService = new ZkpServiceImpl();

        const proofPath = resolve(process.cwd(), "zkp/build/proof-valid.json");
        const publicPath = resolve(process.cwd(), "zkp/build/public-valid.json");

        validProof = JSON.parse(await readFile(proofPath, "utf8"));
        validSignals = JSON.parse(await readFile(publicPath, "utf8"));
    });

    describe("computeCommitment", () => {
        it("should match known Poseidon test vector for credits=30, status=1, version=1, randomness=123456789", async () => {
            const commitment = await zkpService.computeCommitment(
                30,
                1,
                1,
                TEST_RANDOMNESS,
            );
            expect(commitment).toBe(TEST_COMMITMENT);
        });

        it("should handle status as LicenseStatusEnum.ACTIVE", async () => {
            const commitment = await zkpService.computeCommitment(
                30,
                LicenseStatusEnum.ACTIVE,
                1,
                TEST_RANDOMNESS,
            );
            expect(commitment).toBe(TEST_COMMITMENT);
        });

        it("should handle status as 'ACTIVE'", async () => {
            const commitment = await zkpService.computeCommitment(
                30,
                "ACTIVE",
                1,
                TEST_RANDOMNESS,
            );
            expect(commitment).toBe(TEST_COMMITMENT);
        });

        it("should handle status as 'REVOKED' (0)", async () => {
            const commitment = await zkpService.computeCommitment(
                10,
                LicenseStatusEnum.REVOKED,
                1,
                TEST_RANDOMNESS,
            );
            expect(typeof commitment).toBe("string");
            expect(commitment).toMatch(/^[0-9]+$/);
            expect(commitment).not.toBe(TEST_COMMITMENT);
        });
    });

    describe("computeChallengeBinding", () => {
        it("should match known Poseidon test vector for commitment, challenge, randomness", async () => {
            const binding = await zkpService.computeChallengeBinding(
                TEST_COMMITMENT,
                TEST_CHALLENGE,
                TEST_RANDOMNESS,
            );
            expect(binding).toBe(TEST_CHALLENGE_BINDING);
        });
    });

    describe("verifyProof", () => {
        it("should verify valid proof and public signals as string array", async () => {
            const isValid = await zkpService.verifyProof(validProof, validSignals);
            expect(isValid).toBe(true);
        });

        it("should verify valid proof and public signals as object", async () => {
            const isValid = await zkpService.verifyProof(validProof, {
                commitment: validSignals[0],
                challenge: validSignals[1],
                challengeBinding: validSignals[2],
            });
            expect(isValid).toBe(true);
        });

        it("should reject when challenge signal is altered (anti-replay check)", async () => {
            // Change challenge from 42 to 43
            const alteredSignals: [string, string, string] = [
                validSignals[0],
                "43",
                validSignals[2],
            ];
            const isValid = await zkpService.verifyProof(validProof, alteredSignals);
            expect(isValid).toBe(false);
        });

        it("should reject when commitment signal is altered", async () => {
            const alteredSignals: [string, string, string] = [
                "12345678901234567890",
                validSignals[1],
                validSignals[2],
            ];
            const isValid = await zkpService.verifyProof(validProof, alteredSignals);
            expect(isValid).toBe(false);
        });

        it("should reject when challengeBinding signal is altered", async () => {
            const alteredSignals: [string, string, string] = [
                validSignals[0],
                validSignals[1],
                "99999999999999999999",
            ];
            const isValid = await zkpService.verifyProof(validProof, alteredSignals);
            expect(isValid).toBe(false);
        });

        it("should reject when proof parameters are corrupted", async () => {
            const corruptedProof: Groth16Proof = {
                ...validProof,
                pi_a: [
                    "9999999999999999999999999999999999999999",
                    validProof.pi_a[1],
                    validProof.pi_a[2],
                ],
            };
            const isValid = await zkpService.verifyProof(corruptedProof, validSignals);
            expect(isValid).toBe(false);
        });

        it("should return false for malformed proof or invalid signals array", async () => {
            expect(
                await zkpService.verifyProof(
                    null as unknown as Groth16Proof,
                    validSignals,
                ),
            ).toBe(false);
            expect(
                await zkpService.verifyProof(
                    validProof,
                    [] as unknown as [string, string, string],
                ),
            ).toBe(false);
            expect(
                await zkpService.verifyProof(
                    validProof,
                    ["only_one"] as unknown as [string, string, string],
                ),
            ).toBe(false);
        });
    });

    describe("generateProof", () => {
        it("should generate a valid Groth16 proof and publicSignals matching circuit logic", async () => {
            const witness: LicenseZkpWitness = {
                credits: 30,
                status: LicenseStatusEnum.ACTIVE,
                version: 1,
                randomness: TEST_RANDOMNESS,
            };

            const result = await zkpService.generateProof(witness, TEST_CHALLENGE);

            expect(result.proof).toBeDefined();
            expect(result.proof.protocol).toBe("groth16");
            expect(result.publicSignals).toHaveLength(3);
            expect(result.publicSignals[0]).toBe(TEST_COMMITMENT);
            expect(result.publicSignals[1]).toBe(TEST_CHALLENGE);
            expect(result.publicSignals[2]).toBe(TEST_CHALLENGE_BINDING);

            // Now verify the newly generated proof
            const isValid = await zkpService.verifyProof(result.proof, result.publicSignals);
            expect(isValid).toBe(true);
        }, 15000); // Allow up to 15s for Groth16 witness calculation + proving

        it("should reject missing or invalid witness inputs", async () => {
            await expect(
                zkpService.generateProof(
                    null as unknown as LicenseZkpWitness,
                    "42",
                ),
            ).rejects.toThrow("Witness must be a valid object");
            await expect(
                zkpService.generateProof(
                    {
                        credits: 30,
                        status: LicenseStatusEnum.ACTIVE,
                        version: 1,
                        randomness: TEST_RANDOMNESS,
                    },
                    "",
                ),
            ).rejects.toThrow("Challenge must not be empty");
        });

        it("should fail proof generation if credits >= 15 but status is REVOKED due to status === 1 constraint", async () => {
            const revokedWitness: LicenseZkpWitness = {
                credits: 20,
                status: LicenseStatusEnum.REVOKED,
                version: 1,
                randomness: TEST_RANDOMNESS,
            };

            await expect(
                zkpService.generateProof(revokedWitness, TEST_CHALLENGE),
            ).rejects.toThrow();
        });

        it("should throw ZkpConfigError when wasm or zkey file is not found", async () => {
            const brokenService = new ZkpServiceImpl({
                wasmPath: "/non/existent/path.wasm",
            });
            const witness: LicenseZkpWitness = {
                credits: 30,
                status: LicenseStatusEnum.ACTIVE,
                version: 1,
                randomness: TEST_RANDOMNESS,
            };

            await expect(brokenService.generateProof(witness, "42")).rejects.toThrow(
                ZkpConfigError,
            );
        });
    });
});
