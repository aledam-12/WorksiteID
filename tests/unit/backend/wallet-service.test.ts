import {
    WalletService,
    WalletServiceImpl,
} from "../../../backend/src/services/wallet-service.js";
import {
    InMemoryWalletRepository,
    WalletRepository,
} from "../../../backend/src/repositories/wallet-repository.js";
import { Wallet } from "../../../backend/src/domain/wallet.js";
import { WebAuthnUserType } from "../../../backend/src/domain/webauthn-credentials.js";

describe("WalletService", () => {
    let walletRepository: WalletRepository;
    let walletService: WalletService;

    const createWallet = (
        userId = "WRK-001",
        userType = WebAuthnUserType.WORKER,
    ) => new Wallet(userId, userType);

    beforeEach(() => {
        walletRepository = new InMemoryWalletRepository();
        walletService = new WalletServiceImpl(walletRepository);
    });

    describe("initializeWallet", () => {
        it("should initialize and persist a wallet", async () => {
            const wallet = await walletService.initializeWallet(
                "WRK-001",
                WebAuthnUserType.WORKER,
            );

            expect(wallet).toEqual(createWallet());
            expect(await walletRepository.findByUserId("WRK-001")).toEqual(wallet);
        });

        it("should reject initializing a wallet for a user that already has one", async () => {
            const wallet = createWallet();

            await walletService.initializeWallet(wallet.userId, wallet.userType);

            await expect(
                walletService.initializeWallet(wallet.userId, wallet.userType),
            ).rejects.toThrow("Wallet already exists");
        });
    });

    describe("getWallet", () => {
        it("should return the wallet when it exists", async () => {
            const created = await walletService.initializeWallet(
                "WRK-001",
                WebAuthnUserType.WORKER,
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