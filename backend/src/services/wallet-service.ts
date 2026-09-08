import { PrivateLicenseState, Wallet } from "../domain/wallet.js";
import { WebAuthnUserType } from "../domain/webauthn-credentials.js";
import { WalletRepository } from "../repositories/wallet-repository.js";

export interface WalletService {
  initializeWallet(
    userId: string,
    userType: WebAuthnUserType,
    licenseState?: PrivateLicenseState,
  ): Promise<Wallet>;

  updateLicenseState(
    userId: string,
    licenseState: PrivateLicenseState,
  ): Promise<Wallet>;

  getWallet(userId: string): Promise<Wallet | null>;
}

export class WalletServiceImpl implements WalletService {
  constructor(private readonly walletRepository: WalletRepository) {}

  async initializeWallet(
    userId: string,
    userType: WebAuthnUserType,
    licenseState?: PrivateLicenseState,
  ): Promise<Wallet> {
    const existingWallet = await this.walletRepository.findByUserId(userId);

    if (existingWallet !== null) {
      throw new Error("Wallet already exists");
    }

    const wallet = new Wallet(userId, userType, licenseState);

    await this.walletRepository.register(wallet);

    return wallet;
  }

  async updateLicenseState(
    userId: string,
    licenseState: PrivateLicenseState,
  ): Promise<Wallet> {
    const wallet = await this.walletRepository.findByUserId(userId);

    if (!wallet) {
      throw new Error("Wallet does not exist");
    }

    if (wallet.userType !== WebAuthnUserType.WORKER) {
      throw new Error("Cannot update license state for non-worker wallet");
    }

    const updated = new Wallet(wallet.userId, wallet.userType, licenseState);
    await this.walletRepository.update(updated);

    return updated;
  }

  async getWallet(userId: string): Promise<Wallet | null> {
    return await this.walletRepository.findByUserId(userId);
  }
}
