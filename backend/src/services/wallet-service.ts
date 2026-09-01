import { Wallet } from "../domain/wallet.js";
import { WebAuthnUserType } from "../domain/webauthn-credentials.js";
import { WalletRepository } from "../repositories/wallet-repository.js";

export interface WalletService {
    initializeWallet(
        userId: string,
        userType: WebAuthnUserType,
    ): Promise<Wallet>;

    getWallet(userId: string): Promise<Wallet | null>;
}

export class WalletServiceImpl implements WalletService {

    constructor(private readonly walletRepository: WalletRepository) { }

    async initializeWallet(userId: string, userType: WebAuthnUserType): Promise<Wallet> {
        const existingWallet = await this.walletRepository.findByUserId(userId);

        if (existingWallet !== null) {
            throw new Error("Wallet already exists");
        }

        const wallet = new Wallet(userId, userType);

        await this.walletRepository.register(wallet);

        return wallet;
    }

    async getWallet(userId: string): Promise<Wallet | null> {
        return await this.walletRepository.findByUserId(userId);
    }
}