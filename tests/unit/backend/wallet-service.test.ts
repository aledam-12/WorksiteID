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

  const createLicenseState = (): PrivateLicenseState => ({
    licenseId: "LIC-001",
    credits: 30,
    status: LicenseStatusEnum.ACTIVE,
    randomness: commitmentService.generateRandomness(),
    version: 1,
  });

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
