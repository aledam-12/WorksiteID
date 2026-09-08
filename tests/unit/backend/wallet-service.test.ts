import {
  WalletService,
  WalletServiceImpl,
} from "../../../backend/src/services/wallet-service.js";
import {
  InMemoryWalletRepository,
  WalletRepository,
} from "../../../backend/src/repositories/wallet-repository.js";
import {
  PrivateLicenseState,
  Wallet,
} from "../../../backend/src/domain/wallet.js";
import { WebAuthnUserType } from "../../../backend/src/domain/webauthn-credentials.js";
import { LicenseStatusEnum } from "../../../backend/src/domain/license.js";
import { CommitmentServiceImpl } from "../../../backend/src/services/commitment-service.js";

describe("WalletService", () => {
  let walletRepository: WalletRepository;
  let walletService: WalletService;
  const commitmentService = new CommitmentServiceImpl();

  const createLicenseState = (
    overrides?: Partial<{
      licenseId: string;
      credits: number;
      status: LicenseStatusEnum;
      randomness: string;
      version: number;
    }>,
  ): PrivateLicenseState =>
    new PrivateLicenseState(
      overrides?.licenseId ?? "LIC-001",
      overrides?.credits ?? 30,
      overrides?.status ?? LicenseStatusEnum.ACTIVE,
      overrides?.randomness ?? commitmentService.generateRandomness(),
      overrides?.version ?? 1,
    );

  beforeEach(() => {
    walletRepository = new InMemoryWalletRepository();
    walletService = new WalletServiceImpl(walletRepository);
  });

  describe("initializeWallet", () => {
    it("should initialize and persist a Worker wallet with private license state", async () => {
      const licenseState = createLicenseState();

      const wallet = await walletService.initializeWallet(
        "WRK-001",
        WebAuthnUserType.WORKER,
        licenseState,
      );

      const expected = new Wallet(
        "WRK-001",
        WebAuthnUserType.WORKER,
        licenseState,
      );

      expect(wallet).toEqual(expected);
      expect(wallet.licenseState).toBeInstanceOf(PrivateLicenseState);
      expect(wallet.licenseState).toEqual(licenseState);
      expect(await walletRepository.findByUserId("WRK-001")).toEqual(wallet);
    });

    it("should initialize and persist an Inspector wallet without license state", async () => {
      const wallet = await walletService.initializeWallet(
        "INSP-001",
        WebAuthnUserType.INSPECTOR,
      );

      const expected = new Wallet("INSP-001", WebAuthnUserType.INSPECTOR);

      expect(wallet).toEqual(expected);
      expect(wallet.licenseState).toBeUndefined();
      expect(await walletRepository.findByUserId("INSP-001")).toEqual(wallet);
    });

    it("should reject initializing a wallet for a user that already has one", async () => {
      const licenseState = createLicenseState();

      await walletService.initializeWallet(
        "WRK-001",
        WebAuthnUserType.WORKER,
        licenseState,
      );

      await expect(
        walletService.initializeWallet(
          "WRK-001",
          WebAuthnUserType.WORKER,
          licenseState,
        ),
      ).rejects.toThrow("Wallet already exists");
    });
  });

  describe("updateLicenseState", () => {
    it("should update and persist private license state for a Worker wallet", async () => {
      const initialLicenseState = createLicenseState();

      await walletService.initializeWallet(
        "WRK-001",
        WebAuthnUserType.WORKER,
        initialLicenseState,
      );

      const nextRandomness = commitmentService.generateRandomness();
      const updatedLicenseState = new PrivateLicenseState(
        "LIC-001",
        25,
        LicenseStatusEnum.ACTIVE,
        nextRandomness,
        2,
      );

      const updatedWallet = await walletService.updateLicenseState(
        "WRK-001",
        updatedLicenseState,
      );

      expect(updatedWallet.licenseState).toEqual(updatedLicenseState);
      expect(updatedWallet.licenseState?.version).toBe(2);
      expect(updatedWallet.licenseState?.credits).toBe(25);
      expect(updatedWallet.licenseState?.randomness).toBe(nextRandomness);

      const retrieved = await walletService.getWallet("WRK-001");
      expect(retrieved).toEqual(updatedWallet);
      expect(retrieved?.licenseState).toBeInstanceOf(PrivateLicenseState);
    });

    it("should reject updating license state when wallet does not exist", async () => {
      const licenseState = createLicenseState();

      await expect(
        walletService.updateLicenseState("WRK-999", licenseState),
      ).rejects.toThrow("Wallet does not exist");
    });

    it("should reject updating license state for an Inspector wallet", async () => {
      await walletService.initializeWallet(
        "INSP-001",
        WebAuthnUserType.INSPECTOR,
      );

      const licenseState = createLicenseState();

      await expect(
        walletService.updateLicenseState("INSP-001", licenseState),
      ).rejects.toThrow("Cannot update license state for non-worker wallet");
    });
  });

  describe("getWallet", () => {
    it("should return the wallet when it exists", async () => {
      const licenseState = createLicenseState();

      const created = await walletService.initializeWallet(
        "WRK-001",
        WebAuthnUserType.WORKER,
        licenseState,
      );

      const wallet = await walletService.getWallet("WRK-001");

      expect(wallet).toEqual(created);
    });

    it("should return null when the wallet does not exist", async () => {
      const wallet = await walletService.getWallet("WRK-999");

      expect(wallet).toBeNull();
    });
  });
});
