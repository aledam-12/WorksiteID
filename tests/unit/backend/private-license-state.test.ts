import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrivateLicenseState } from "../../../backend/src/domain/private-license-state.js";
import { Wallet } from "../../../backend/src/domain/wallet.js";
import { WebAuthnUserType } from "../../../backend/src/domain/webauthn-credentials.js";
import { LicenseStatusEnum } from "../../../backend/src/domain/license.js";
import { CommitmentServiceImpl } from "../../../backend/src/services/commitment-service.js";
import {
    InMemoryWalletRepository,
    LocalWalletRepository,
} from "../../../backend/src/repositories/wallet-repository.js";
import { WalletServiceImpl } from "../../../backend/src/services/wallet-service.js";

describe("PrivateLicenseState & Wallet Integration", () => {
    const commitmentService = new CommitmentServiceImpl();

    describe("creazione dello stato privato", () => {
        it("should create a valid PrivateLicenseState instance via constructor", () => {
            const randomness = commitmentService.generateRandomness();
            const state = new PrivateLicenseState(
                "LIC-001",
                30,
                LicenseStatusEnum.ACTIVE,
                randomness,
                1,
            );

            expect(state.licenseId).toBe("LIC-001");
            expect(state.credits).toBe(30);
            expect(state.status).toBe(LicenseStatusEnum.ACTIVE);
            expect(state.randomness).toBe(randomness);
            expect(state.version).toBe(1);
        });

        it("should create an initial PrivateLicenseState via factory with default credits, ACTIVE status, and version 1", () => {
            const state = PrivateLicenseState.createInitial(
                "LIC-002",
                commitmentService,
            );

            expect(state.licenseId).toBe("LIC-002");
            expect(state.credits).toBe(30);
            expect(state.status).toBe(LicenseStatusEnum.ACTIVE);
            expect(state.version).toBe(1);
            expect(state.randomness).toBeDefined();
        });
    });

    describe("validazione dei parametri di stato privato", () => {
        const validRandomness = commitmentService.generateRandomness();

        it("should reject an empty or whitespace-only license ID", () => {
            expect(
                () =>
                    new PrivateLicenseState(
                        "",
                        30,
                        LicenseStatusEnum.ACTIVE,
                        validRandomness,
                        1,
                    ),
            ).toThrow("License ID cannot be empty");

            expect(
                () =>
                    new PrivateLicenseState(
                        "   ",
                        30,
                        LicenseStatusEnum.ACTIVE,
                        validRandomness,
                        1,
                    ),
            ).toThrow("License ID cannot be empty");
        });

        it("should reject negative or non-number credits", () => {
            expect(
                () =>
                    new PrivateLicenseState(
                        "LIC-001",
                        -1,
                        LicenseStatusEnum.ACTIVE,
                        validRandomness,
                        1,
                    ),
            ).toThrow("Credits must be a non-negative integer");

            expect(
                () =>
                    new PrivateLicenseState(
                        "LIC-001",
                        NaN,
                        LicenseStatusEnum.ACTIVE,
                        validRandomness,
                        1,
                    ),
            ).toThrow("Credits must be a non-negative integer");
        });

        it("should reject decimal credits", () => {
            expect(
                () =>
                    new PrivateLicenseState(
                        "LIC-001",
                        1.5,
                        LicenseStatusEnum.REVOKED,
                        validRandomness,
                        1,
                    ),
            ).toThrow("Credits must be a non-negative integer");

            expect(
                () =>
                    new PrivateLicenseState(
                        "LIC-001",
                        10.7,
                        LicenseStatusEnum.REVOKED,
                        validRandomness,
                        1,
                    ),
            ).toThrow("Credits must be a non-negative integer");
        });

        it("should enforce domain invariants between credits and status", () => {
            // credits = 15, ACTIVE -> valido
            const state15 = new PrivateLicenseState(
                "LIC-001",
                15,
                LicenseStatusEnum.ACTIVE,
                validRandomness,
                1,
            );
            expect(state15.credits).toBe(15);
            expect(state15.status).toBe(LicenseStatusEnum.ACTIVE);

            // credits = 30, ACTIVE -> valido
            const state30 = new PrivateLicenseState(
                "LIC-001",
                30,
                LicenseStatusEnum.ACTIVE,
                validRandomness,
                1,
            );
            expect(state30.credits).toBe(30);
            expect(state30.status).toBe(LicenseStatusEnum.ACTIVE);

            // credits = 14, REVOKED -> valido
            const state14 = new PrivateLicenseState(
                "LIC-001",
                14,
                LicenseStatusEnum.REVOKED,
                validRandomness,
                1,
            );
            expect(state14.credits).toBe(14);
            expect(state14.status).toBe(LicenseStatusEnum.REVOKED);

            // credits = 0, REVOKED -> valido
            const state0 = new PrivateLicenseState(
                "LIC-001",
                0,
                LicenseStatusEnum.REVOKED,
                validRandomness,
                1,
            );
            expect(state0.credits).toBe(0);
            expect(state0.status).toBe(LicenseStatusEnum.REVOKED);

            // credits = 14, ACTIVE -> rifiutato
            expect(
                () =>
                    new PrivateLicenseState(
                        "LIC-001",
                        14,
                        LicenseStatusEnum.ACTIVE,
                        validRandomness,
                        1,
                    ),
            ).toThrow("Invalid status for 14 credits: status must be REVOKED when credits < 15");

            // credits = 0, ACTIVE -> rifiutato
            expect(
                () =>
                    new PrivateLicenseState(
                        "LIC-001",
                        0,
                        LicenseStatusEnum.ACTIVE,
                        validRandomness,
                        1,
                    ),
            ).toThrow("Invalid status for 0 credits: status must be REVOKED when credits < 15");

            // credits = 30, REVOKED -> rifiutato
            expect(
                () =>
                    new PrivateLicenseState(
                        "LIC-001",
                        30,
                        LicenseStatusEnum.REVOKED,
                        validRandomness,
                        1,
                    ),
            ).toThrow("Invalid status for 30 credits: status must be ACTIVE when credits >= 15");
        });

        it("should reject invalid status", () => {
            expect(
                () =>
                    new PrivateLicenseState(
                        "LIC-001",
                        30,
                        "UNKNOWN_STATUS" as LicenseStatusEnum,
                        validRandomness,
                        1,
                    ),
            ).toThrow("Invalid license status: UNKNOWN_STATUS");
        });

        it("should reject empty or whitespace-only randomness", () => {
            expect(
                () =>
                    new PrivateLicenseState(
                        "LIC-001",
                        30,
                        LicenseStatusEnum.ACTIVE,
                        "",
                        1,
                    ),
            ).toThrow("Randomness cannot be empty");

            expect(
                () =>
                    new PrivateLicenseState(
                        "LIC-001",
                        30,
                        LicenseStatusEnum.ACTIVE,
                        "   ",
                        1,
                    ),
            ).toThrow("Randomness cannot be empty");
        });

        it("should reject version less than 1 or non-integer version", () => {
            expect(
                () =>
                    new PrivateLicenseState(
                        "LIC-001",
                        30,
                        LicenseStatusEnum.ACTIVE,
                        validRandomness,
                        0,
                    ),
            ).toThrow("Version must be an integer greater than or equal to 1");

            expect(
                () =>
                    new PrivateLicenseState(
                        "LIC-001",
                        30,
                        LicenseStatusEnum.ACTIVE,
                        validRandomness,
                        -1,
                    ),
            ).toThrow("Version must be an integer greater than or equal to 1");

            expect(
                () =>
                    new PrivateLicenseState(
                        "LIC-001",
                        30,
                        LicenseStatusEnum.ACTIVE,
                        validRandomness,
                        1.5,
                    ),
            ).toThrow("Version must be an integer greater than or equal to 1");
        });
    });

    describe("randomness presente", () => {
        it("should have a cryptographically secure, non-empty randomness of 64 hex chars", () => {
            const state = PrivateLicenseState.createInitial(
                "LIC-001",
                commitmentService,
            );

            expect(typeof state.randomness).toBe("string");
            expect(state.randomness).toHaveLength(64);
            expect(state.randomness).toMatch(/^[0-9a-f]{64}$/);
        });

        it("should generate distinct randomness for each new state instance", () => {
            const state1 = PrivateLicenseState.createInitial(
                "LIC-001",
                commitmentService,
            );
            const state2 = PrivateLicenseState.createInitial(
                "LIC-001",
                commitmentService,
            );

            expect(state1.randomness).not.toBe(state2.randomness);
        });
    });

    describe("version iniziale", () => {
        it("should have initial version equal to 1", () => {
            const state = PrivateLicenseState.createInitial(
                "LIC-001",
                commitmentService,
            );

            expect(state.version).toBe(1);
        });
    });

    describe("generazione del commitment", () => {
        it("should generate a valid SHA-256 commitment from the private state", () => {
            const state = PrivateLicenseState.createInitial(
                "LIC-001",
                commitmentService,
            );

            const commitment = state.computeCommitment(commitmentService);

            expect(typeof commitment).toBe("string");
            expect(commitment).toHaveLength(64);
            expect(commitment).toMatch(/^[0-9a-f]{64}$/);

            // Directly matches CommitmentService calculation
            const expectedCommitment = commitmentService.createCommitment(
                state.toCommitmentState(),
                state.randomness,
            );
            expect(commitment).toBe(expectedCommitment);
        });

        it("should produce the same commitment when called on the same state", () => {
            const state = PrivateLicenseState.createInitial(
                "LIC-001",
                commitmentService,
            );

            const c1 = state.computeCommitment(commitmentService);
            const c2 = state.computeCommitment(commitmentService);

            expect(c1).toBe(c2);
        });
    });

    describe("persistenza e recupero dello stato", () => {
        let tempDir: string;
        let filePath: string;

        beforeEach(async () => {
            tempDir = await mkdtemp(join(tmpdir(), "private-state-test-"));
            filePath = join(tempDir, "data", "wallets.json");
        });

        afterEach(async () => {
            await rm(tempDir, { recursive: true, force: true });
        });

        it("should persist and retrieve private license state in InMemoryWalletRepository", async () => {
            const repo = new InMemoryWalletRepository();
            const licenseState = PrivateLicenseState.createInitial(
                "LIC-001",
                commitmentService,
            );
            const wallet = new Wallet(
                "WRK-001",
                WebAuthnUserType.WORKER,
                licenseState,
            );

            await repo.register(wallet);

            const retrieved = await repo.findByUserId("WRK-001");
            expect(retrieved).not.toBeNull();
            expect(retrieved?.licenseState).toEqual(licenseState);
            expect(retrieved?.licenseState?.licenseId).toBe("LIC-001");
            expect(retrieved?.licenseState?.randomness).toBe(licenseState.randomness);
            expect(retrieved?.licenseState?.version).toBe(1);
        });

        it("should persist and retrieve private license state in LocalWalletRepository with full class instance", async () => {
            const repo = new LocalWalletRepository(filePath);
            const licenseState = PrivateLicenseState.createInitial(
                "LIC-001",
                commitmentService,
            );
            const wallet = new Wallet(
                "WRK-001",
                WebAuthnUserType.WORKER,
                licenseState,
            );

            await repo.register(wallet);

            // Re-read from disk with a fresh repository instance
            const repo2 = new LocalWalletRepository(filePath);
            const retrieved = await repo2.findByUserId("WRK-001");

            expect(retrieved).not.toBeNull();
            expect(retrieved?.licenseState).toBeInstanceOf(PrivateLicenseState);
            expect(retrieved?.licenseState?.licenseId).toBe("LIC-001");
            expect(retrieved?.licenseState?.credits).toBe(30);
            expect(retrieved?.licenseState?.status).toBe(LicenseStatusEnum.ACTIVE);
            expect(retrieved?.licenseState?.randomness).toBe(licenseState.randomness);
            expect(retrieved?.licenseState?.version).toBe(1);
        });
    });

    describe("ricostruzione del commitment", () => {
        let tempDir: string;
        let filePath: string;

        beforeEach(async () => {
            tempDir = await mkdtemp(join(tmpdir(), "reconstruct-commit-"));
            filePath = join(tempDir, "data", "wallets.json");
        });

        afterEach(async () => {
            await rm(tempDir, { recursive: true, force: true });
        });

        it("should reconstruct the exact commitment after persisting and retrieving from local wallet", async () => {
            const repo = new LocalWalletRepository(filePath);
            const licenseState = PrivateLicenseState.createInitial(
                "LIC-001",
                commitmentService,
            );
            const originalCommitment = licenseState.computeCommitment(commitmentService);

            const wallet = new Wallet(
                "WRK-001",
                WebAuthnUserType.WORKER,
                licenseState,
            );
            await repo.register(wallet);

            // Retrieve from persistent storage
            const freshRepo = new LocalWalletRepository(filePath);
            const retrievedWallet = await freshRepo.findByUserId("WRK-001");

            expect(retrievedWallet).not.toBeNull();
            expect(retrievedWallet?.licenseState).toBeDefined();

            // Reconstruct commitment from the retrieved state
            const reconstructedCommitment =
                retrievedWallet!.licenseState!.computeCommitment(commitmentService);

            expect(reconstructedCommitment).toBe(originalCommitment);
        });
    });

    describe("verifica del commitment", () => {
        it("should return true when verifying a matching commitment", () => {
            const state = PrivateLicenseState.createInitial(
                "LIC-001",
                commitmentService,
            );
            const commitment = state.computeCommitment(commitmentService);

            expect(state.verifyCommitment(commitmentService, commitment)).toBe(true);
        });

        it("should return false when verifying a modified or wrong commitment", () => {
            const state = PrivateLicenseState.createInitial(
                "LIC-001",
                commitmentService,
            );
            const commitment = state.computeCommitment(commitmentService);

            const tampered =
                commitment.slice(0, -1) + (commitment.endsWith("0") ? "1" : "0");

            expect(state.verifyCommitment(commitmentService, tampered)).toBe(false);
            expect(state.verifyCommitment(commitmentService, "invalid")).toBe(false);
        });
    });

    describe("aggiornamento della versione", () => {
        let tempDir: string;
        let filePath: string;

        beforeEach(async () => {
            tempDir = await mkdtemp(join(tmpdir(), "version-update-"));
            filePath = join(tempDir, "data", "wallets.json");
        });

        afterEach(async () => {
            await rm(tempDir, { recursive: true, force: true });
        });

        it("should increment version, generate new randomness, and produce a new commitment", () => {
            const stateV1 = PrivateLicenseState.createInitial(
                "LIC-001",
                commitmentService,
                30,
            );
            const commitmentV1 = stateV1.computeCommitment(commitmentService);

            // Transition to next version (e.g. after penalty, 25 credits)
            const stateV2 = stateV1.nextVersion(commitmentService, {
                credits: 25,
            });

            expect(stateV2.version).toBe(2);
            expect(stateV2.credits).toBe(25);
            expect(stateV2.licenseId).toBe("LIC-001");
            expect(stateV2.status).toBe(LicenseStatusEnum.ACTIVE);
            expect(stateV2.randomness).not.toBe(stateV1.randomness);

            const commitmentV2 = stateV2.computeCommitment(commitmentService);
            expect(commitmentV2).not.toBe(commitmentV1);

            // Each version verifies against its own commitment
            expect(stateV1.verifyCommitment(commitmentService, commitmentV1)).toBe(true);
            expect(stateV2.verifyCommitment(commitmentService, commitmentV2)).toBe(true);
            expect(stateV1.verifyCommitment(commitmentService, commitmentV2)).toBe(false);
        });

        it("should update wallet in repository and persist the new version", async () => {
            const repo = new LocalWalletRepository(filePath);
            const walletService = new WalletServiceImpl(repo);

            const stateV1 = PrivateLicenseState.createInitial(
                "LIC-001",
                commitmentService,
            );
            await walletService.initializeWallet(
                "WRK-001",
                WebAuthnUserType.WORKER,
                stateV1,
            );

            // Update to version 2
            const stateV2 = stateV1.nextVersion(commitmentService, {
                credits: 20,
            });
            const updatedWallet = await walletService.updateLicenseState(
                "WRK-001",
                stateV2,
            );

            expect(updatedWallet.licenseState?.version).toBe(2);
            expect(updatedWallet.licenseState?.credits).toBe(20);

            // Read from new repository instance
            const freshRepo = new LocalWalletRepository(filePath);
            const persisted = await freshRepo.findByUserId("WRK-001");

            expect(persisted?.licenseState?.version).toBe(2);
            expect(persisted?.licenseState?.credits).toBe(20);
            expect(persisted?.licenseState?.randomness).toBe(stateV2.randomness);
            expect(
                persisted?.licenseState?.computeCommitment(commitmentService),
            ).toBe(stateV2.computeCommitment(commitmentService));
        });
    });
});
