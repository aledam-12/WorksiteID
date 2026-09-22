/**
 * @file wallet.service.ts
 * @description Servizio per la gestione del wallet digitale dell'utente.
 * Custodisce in sicurezza le credenziali, lo stato riservato della patente (crediti, blinding randomness)
 * e i dati di sessione crittografica associati ai lavoratori di cantiere.
 *
 * @dependencies
 * - domain/wallet.js: entità di dominio Wallet e stato privato PrivateLicenseState.
 * - domain/webauthn-credentials.js: tipologia utente WebAuthnUserType.
 * - repositories/wallet-repository.js: persistenza e recupero dei wallet.
 */

import { type PrivateLicenseState, Wallet } from "../../domain/wallet.js";
import { WebAuthnUserType } from "../../domain/webauthn-credentials.js";
import { type WalletRepository } from "../../repositories/wallet-repository.js";

/**
 * Contratto per il servizio di gestione del wallet digitale utente.
 */
export interface WalletService {
    /**
     * Inizializza un nuovo wallet digitale per l'utente specificato.
     *
     * @param userId Identificativo univoco dell'utente
     * @param userType Tipologia dell'utente (worker o inspector)
     * @param licenseState Stato privato iniziale della patente (opzionale)
     * @returns Il wallet creato
     * @throws {Error} Se esiste già un wallet registrato per l'utente
     */
    initializeWallet(
        userId: string,
        userType: WebAuthnUserType,
        licenseState?: PrivateLicenseState,
    ): Promise<Wallet>;

    /**
     * Aggiorna lo stato privato della patente (crediti, blinding randomness) nel wallet del lavoratore.
     *
     * @param userId Identificativo del lavoratore titolare del wallet
     * @param licenseState Nuovo stato privato della patente
     * @returns Il wallet aggiornato
     * @throws {Error} Se il wallet non esiste o appartiene a un utente non di tipo worker
     */
    updateLicenseState(
        userId: string,
        licenseState: PrivateLicenseState,
    ): Promise<Wallet>;

    /**
     * Recupera il wallet digitale associato all'ID utente specificato.
     *
     * @param userId Identificativo dell'utente
     * @returns Il wallet trovato o null se non presente
     */
    getWallet(userId: string): Promise<Wallet | null>;
}

/**
 * Implementazione concreta del servizio Wallet basata sul repository di persistenza.
 */
export class WalletServiceImpl implements WalletService {
    /**
     * Inizializza il servizio iniettando il repository del wallet.
     * @param walletRepository Repository di persistenza per le entità Wallet
     */
    constructor(private readonly walletRepository: WalletRepository) {}

    /**
     * Crea e registra un nuovo wallet verificando che non ne esista già uno per l'utente.
     */
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

    /**
     * Aggiorna lo stato privato della patente garantendo che l'utente sia un lavoratore autorizzato.
     */
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

    /**
     * Recupera il wallet dal repository.
     */
    async getWallet(userId: string): Promise<Wallet | null> {
        return await this.walletRepository.findByUserId(userId);
    }
}
