import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  InMemoryWalletRepository,
  LocalWalletRepository,
  WalletRepository,
} from "../../../backend/src/repositories/wallet-repository.js";
import {
  PrivateLicenseState,
  Wallet,
} from "../../../backend/src/domain/wallet.js";
import { WebAuthnUserType } from "../../../backend/src/domain/webauthn-credentials.js";
import { LicenseStatusEnum } from "../../../backend/src/domain/license.js";
import { CommitmentServiceImpl } from "../../../backend/src/services/commitment-service.js";

describe("InMemoryWalletRepository", () => {
  let repository: WalletRepository;
  const commitmentService = new CommitmentServiceImpl();

  const createWorkerWallet = (
    userId = "WRK-001",
    licenseState?: Partial<PrivateLicenseState>,
  ) =>
    new Wallet(userId, WebAuthnUserType.WORKER, {
      licenseId: "LIC-001",
      credits: 30,
      status: LicenseStatusEnum.ACTIVE,
      randomness: commitmentService.generateRandomness(),
      version: 1,
      ...licenseState,
    });

  beforeEach(() => {
    repository = new InMemoryWalletRepository();
  });

  describe("register", () => {
    it("should register a Worker wallet with private license state", async () => {
      const wallet = createWorkerWallet();

      await repository.register(wallet);

      const found = await repository.findByUserId(wallet.userId);
      expect(found).toEqual(wallet);
      expect(found?.licenseState?.licenseId).toBe("LIC-001");
      expect(found?.licenseState?.credits).toBe(30);
      expect(found?.licenseState?.status).toBe(LicenseStatusEnum.ACTIVE);
      expect(found?.licenseState?.randomness).toBe(wallet.licenseState?.randomness);
      expect(found?.licenseState?.version).toBe(1);
    });

    it("should register an Inspector wallet without license state", async () => {
      const wallet = new Wallet("INSP-001", WebAuthnUserType.INSPECTOR);

      await repository.register(wallet);

      const found = await repository.findByUserId("INSP-001");
      expect(found).toEqual(wallet);
      expect(found?.userType).toBe(WebAuthnUserType.INSPECTOR);
      expect(found?.licenseState).toBeUndefined();
    });
  });

  describe("findByUserId", () => {
    it("should return the wallet when it exists", async () => {
      const wallet = createWorkerWallet("WRK-002");

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
      const wallet = createWorkerWallet();

      await repository.register(wallet);

      expect(await repository.existsByUserId("WRK-001")).toBe(true);
    });

    it("should return false when the wallet does not exist", async () => {
      expect(await repository.existsByUserId("WRK-999")).toBe(false);
    });
  });

  describe("duplicate wallets", () => {
    it("should reject a wallet for a user that already has one", async () => {
      const firstWallet = createWorkerWallet("WRK-001");
      const secondWallet = createWorkerWallet("WRK-001");

      await repository.register(firstWallet);

      await expect(repository.register(secondWallet)).rejects.toThrow(
        "Wallet already exists",
      );
    });
  });
});

describe("LocalWalletRepository", () => {
  let tempDir: string;
  let filePath: string;
  let repository: LocalWalletRepository;
  const commitmentService = new CommitmentServiceImpl();

  const createWorkerWallet = (
    userId = "WRK-001",
    licenseState?: Partial<PrivateLicenseState>,
  ) =>
    new Wallet(userId, WebAuthnUserType.WORKER, {
      licenseId: "LIC-001",
      credits: 30,
      status: LicenseStatusEnum.ACTIVE,
      randomness: commitmentService.generateRandomness(),
      version: 1,
      ...licenseState,
    });

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "wallet-repo-test-"));
    filePath = join(tempDir, "data", "wallets.json");
    repository = new LocalWalletRepository(filePath);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("register and findByUserId", () => {
    it("should register and retrieve a Worker Wallet instance with private license state", async () => {
      const wallet = createWorkerWallet("WRK-001");

      await repository.register(wallet);

      const found = await repository.findByUserId("WRK-001");
      expect(found).toEqual(wallet);
      expect(found).toBeInstanceOf(Wallet);
      expect(found?.userId).toBe("WRK-001");
      expect(found?.userType).toBe(WebAuthnUserType.WORKER);
      expect(found?.licenseState).toBeDefined();
      expect(found?.licenseState?.licenseId).toBe("LIC-001");
      expect(found?.licenseState?.credits).toBe(30);
      expect(found?.licenseState?.status).toBe(LicenseStatusEnum.ACTIVE);
      expect(found?.licenseState?.randomness).toBe(wallet.licenseState?.randomness);
      expect(found?.licenseState?.version).toBe(1);
    });

    it("should register and retrieve an Inspector Wallet instance without license state", async () => {
      const wallet = new Wallet("INSP-001", WebAuthnUserType.INSPECTOR);

      await repository.register(wallet);

      const found = await repository.findByUserId("INSP-001");
      expect(found).toEqual(wallet);
      expect(found).toBeInstanceOf(Wallet);
      expect(found?.userId).toBe("INSP-001");
      expect(found?.userType).toBe(WebAuthnUserType.INSPECTOR);
      expect(found?.licenseState).toBeUndefined();
    });

    it("should return null when file does not exist yet", async () => {
      const found = await repository.findByUserId("WRK-999");

      expect(found).toBeNull();
    });
  });

  describe("existsByUserId", () => {
    it("should return true when the wallet exists and false otherwise", async () => {
      const wallet = createWorkerWallet("WRK-001");

      expect(await repository.existsByUserId("WRK-001")).toBe(false);

      await repository.register(wallet);

      expect(await repository.existsByUserId("WRK-001")).toBe(true);
      expect(await repository.existsByUserId("WRK-999")).toBe(false);
    });
  });

  describe("duplicate wallets", () => {
    it("should reject a duplicate wallet registration", async () => {
      const firstWallet = createWorkerWallet("WRK-001");
      const secondWallet = createWorkerWallet("WRK-001");

      await repository.register(firstWallet);

      await expect(repository.register(secondWallet)).rejects.toThrow(
        "Wallet already exists",
      );
    });
  });

  describe("file creation and persistence", () => {
    it("should create directory and file automatically if they do not exist", async () => {
      const wallet = createWorkerWallet("WRK-001");

      await repository.register(wallet);

      const found = await repository.findByUserId("WRK-001");
      expect(found).toEqual(wallet);
    });

    it("should maintain persisted data across different repository instances (serialization/deserialization)", async () => {
      const workerWallet = createWorkerWallet("WRK-001", {
        licenseId: "LIC-999",
        credits: 25,
        status: LicenseStatusEnum.ACTIVE,
        version: 2,
      });
      const inspectorWallet = new Wallet(
        "INSP-001",
        WebAuthnUserType.INSPECTOR,
      );

      await repository.register(workerWallet);
      await repository.register(inspectorWallet);

      const secondRepository = new LocalWalletRepository(filePath);

      const foundWorker = await secondRepository.findByUserId("WRK-001");
      expect(foundWorker).toEqual(workerWallet);
      expect(foundWorker).toBeInstanceOf(Wallet);
      expect(foundWorker?.licenseState?.licenseId).toBe("LIC-999");
      expect(foundWorker?.licenseState?.credits).toBe(25);
      expect(foundWorker?.licenseState?.status).toBe(LicenseStatusEnum.ACTIVE);
      expect(foundWorker?.licenseState?.version).toBe(2);

      const foundInspector = await secondRepository.findByUserId("INSP-001");
      expect(foundInspector).toEqual(inspectorWallet);
      expect(foundInspector).toBeInstanceOf(Wallet);
      expect(foundInspector?.licenseState).toBeUndefined();
    });
  });
});
