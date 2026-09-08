import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PrivateLicenseState, Wallet } from "../domain/wallet.js";
import { WebAuthnUserType } from "../domain/webauthn-credentials.js";

export interface WalletRepository {
  register(wallet: Wallet): Promise<void>;
  update(wallet: Wallet): Promise<void>;
  findByUserId(userId: string): Promise<Wallet | null>;
  existsByUserId(userId: string): Promise<boolean>;
}

export class InMemoryWalletRepository implements WalletRepository {
  private wallets: Map<string, Wallet> = new Map();

  async register(wallet: Wallet): Promise<void> {
    if (await this.existsByUserId(wallet.userId)) {
      throw new Error("Wallet already exists");
    }

    this.wallets.set(wallet.userId, wallet);
  }

  async update(wallet: Wallet): Promise<void> {
    if (!(await this.existsByUserId(wallet.userId))) {
      throw new Error("Wallet does not exist");
    }

    this.wallets.set(wallet.userId, wallet);
  }

  async findByUserId(userId: string): Promise<Wallet | null> {
    return this.wallets.get(userId) ?? null;
  }

  async existsByUserId(userId: string): Promise<boolean> {
    return this.wallets.has(userId);
  }
}

interface WalletData {
  userId: string;
  userType: WebAuthnUserType;
  licenseState?: {
    licenseId: string;
    credits: number;
    status: PrivateLicenseState["status"];
    randomness: string;
    version: number;
  };
}

export class LocalWalletRepository implements WalletRepository {
  constructor(private readonly filePath: string) {}

  private toDomain(data: WalletData): Wallet {
    const licenseState = data.licenseState
      ? new PrivateLicenseState(
          data.licenseState.licenseId,
          data.licenseState.credits,
          data.licenseState.status,
          data.licenseState.randomness,
          data.licenseState.version,
        )
      : undefined;

    return new Wallet(data.userId, data.userType, licenseState);
  }

  private toData(wallet: Wallet): WalletData {
    const data: WalletData = {
      userId: wallet.userId,
      userType: wallet.userType,
    };

    if (wallet.licenseState) {
      data.licenseState = {
        licenseId: wallet.licenseState.licenseId,
        credits: wallet.licenseState.credits,
        status: wallet.licenseState.status,
        randomness: wallet.licenseState.randomness,
        version: wallet.licenseState.version,
      };
    }

    return data;
  }

  private async loadWallets(): Promise<WalletData[]> {
    try {
      const data = await readFile(this.filePath, "utf-8");
      return JSON.parse(data) as WalletData[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }

      throw error;
    }
  }

  private async saveWallets(wallets: WalletData[]): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });

    await writeFile(this.filePath, JSON.stringify(wallets, null, 2), "utf-8");
  }

  async register(wallet: Wallet): Promise<void> {
    const wallets = await this.loadWallets();

    if (wallets.some((item) => item.userId === wallet.userId)) {
      throw new Error("Wallet already exists");
    }

    wallets.push(this.toData(wallet));

    await this.saveWallets(wallets);
  }

  async update(wallet: Wallet): Promise<void> {
    const wallets = await this.loadWallets();
    const index = wallets.findIndex((item) => item.userId === wallet.userId);

    if (index === -1) {
      throw new Error("Wallet does not exist");
    }

    wallets[index] = this.toData(wallet);

    await this.saveWallets(wallets);
  }

  async findByUserId(userId: string): Promise<Wallet | null> {
    const wallets = await this.loadWallets();

    const wallet = wallets.find((item) => item.userId === userId);

    return wallet ? this.toDomain(wallet) : null;
  }

  async existsByUserId(userId: string): Promise<boolean> {
    const wallet = await this.findByUserId(userId);

    return wallet !== null;
  }
}
