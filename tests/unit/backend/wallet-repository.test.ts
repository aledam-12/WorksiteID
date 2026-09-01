import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
    InMemoryWalletRepository,
    LocalWalletRepository,
    WalletRepository,
} from "../../../backend/src/repositories/wallet-repository.js";
import { Wallet } from "../../../backend/src/domain/wallet.js";
import { WebAuthnUserType } from "../../../backend/src/domain/webauthn-credentials.js";

describe("InMemoryWalletRepository", () => {
    let repository: WalletRepository;

    const createWallet = (
        userId = "WRK-001",
        userType = WebAuthnUserType.WORKER,
    ) => new Wallet(userId, userType);

    beforeEach(() => {
        repository = new InMemoryWalletRepository();
    });

    describe("register", () => {
        it("should register a wallet", async () => {
            const wallet = createWallet();

            await repository.register(wallet);

            expect(await repository.findByUserId(wallet.userId)).toEqual(wallet);
        });
    });

    describe("findByUserId", () => {
        it("should return the wallet when it exists", async () => {
            const wallet = createWallet("WRK-002");

            await repository.register(wallet);

            const found = await repository.findByUserId("WRK-002");

            expect(found).toEqual(wallet);
        });

        it("should return null when the wallet does not exist", async () => {
            const found = await repository.findByUserId("WRK-999");

            expect(found).toBeNull();
        });
    });

    describe("existsByUserId", () => {
        it("should return true when the wallet exists", async () => {
            const wallet = createWallet();

            await repository.register(wallet);

            expect(await repository.existsByUserId("WRK-001")).toBe(true);
        });

        it("should return false when the wallet does not exist", async () => {
            expect(await repository.existsByUserId("WRK-999")).toBe(false);
        });
    });

    describe("duplicate wallets", () => {
        it("should reject a wallet for a user that already has one", async () => {
            const firstWallet = createWallet("WRK-001");
            const secondWallet = createWallet("WRK-001");

            await repository.register(firstWallet);

            await expect(
                repository.register(secondWallet),
            ).rejects.toThrow("Wallet already exists");
        });
    });
});

describe("LocalWalletRepository", () => {
    let tempDir: string;
    let filePath: string;
    let repository: LocalWalletRepository;

    const createWallet = (
        userId = "WRK-001",
        userType = WebAuthnUserType.WORKER,
    ) => new Wallet(userId, userType);

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), "wallet-repo-test-"));
        filePath = join(tempDir, "data", "wallets.json");
        repository = new LocalWalletRepository(filePath);
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    describe("register and findByUserId", () => {
        it("should register and retrieve a real Wallet instance", async () => {
            const wallet = createWallet("WRK-001");

            await repository.register(wallet);

            const found = await repository.findByUserId("WRK-001");
            expect(found).toEqual(wallet);
            expect(found).toBeInstanceOf(Wallet);
        });

        it("should return null when file does not exist yet", async () => {
            const found = await repository.findByUserId("WRK-999");

            expect(found).toBeNull();
        });
    });

    describe("existsByUserId", () => {
        it("should return true when the wallet exists and false otherwise", async () => {
            const wallet = createWallet("WRK-001");

            expect(await repository.existsByUserId("WRK-001")).toBe(false);

            await repository.register(wallet);

            expect(await repository.existsByUserId("WRK-001")).toBe(true);
            expect(await repository.existsByUserId("WRK-999")).toBe(false);
        });
    });

    describe("duplicate wallets", () => {
        it("should reject a duplicate wallet registration", async () => {
            const firstWallet = createWallet("WRK-001");
            const secondWallet = createWallet("WRK-001");

            await repository.register(firstWallet);

            await expect(repository.register(secondWallet)).rejects.toThrow(
                "Wallet already exists",
            );
        });
    });

    describe("file creation and persistence", () => {
        it("should create directory and file automatically if they do not exist", async () => {
            const wallet = createWallet("WRK-001");

            await repository.register(wallet);

            const found = await repository.findByUserId("WRK-001");
            expect(found).toEqual(wallet);
        });

        it("should maintain persisted data across different repository instances", async () => {
            const wallet = createWallet("WRK-001");

            await repository.register(wallet);

            const secondRepository = new LocalWalletRepository(filePath);
            const found = await secondRepository.findByUserId("WRK-001");

            expect(found).toEqual(wallet);
            expect(found).toBeInstanceOf(Wallet);
            expect(found?.userId).toBe("WRK-001");
            expect(found?.userType).toBe(WebAuthnUserType.WORKER);
        });
    });
});