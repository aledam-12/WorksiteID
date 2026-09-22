/**
 * @file blockchain.service.ts
 * @description Modulo per l'interfaccia con la blockchain Hyperledger Fabric tramite FireFly.
 * Gestisce l'ancoraggio immutabile dello stato pubblico delle patenti e delle sanzioni
 * garantendo la Privacy by Design (nessun dato privato in chiaro sul ledger).
 *
 * @dependencies
 * - domain/license-on-chain.js: modello dello stato pubblico della patente on-chain.
 * - domain/sanction-on-chain.js: modello dei metadati pubblici della sanzione on-chain.
 * - security/blockchain/firefly.client.js: client HTTP per comunicare con FireFly.
 */

import { LicenseOnChain } from "../../domain/license-on-chain.js";
import { SanctionOnChain } from "../../domain/sanction-on-chain.js";
import { FireFlyClient } from "./firefly.client.js";

/**
 * Parametri necessari per registrare una sanzione sulla blockchain.
 */
export interface IssueSanctionOnChainParams {
    /** Identificativo univoco della sanzione */
    sanctionId: string;
    /** Riferimento pseudonimo opaco della patente sanzionata */
    licenseRef: string;
    /** Digest crittografico SHA-256 dei dati privati della sanzione */
    sanctionCommitment: string;
    /** Nuovo commitment Poseidon calcolato a seguito della decurtazione crediti */
    newCommitment: string;
    /** Riferimento pseudonimo dell'ispettore che emette la sanzione */
    inspectorRef: string;
}

/**
 * Struttura della risposta JSON restituita da FireFly per lo stato della patente.
 */
export interface FireFlyLicenseStateResponse {
    licenseRef: string;
    commitment: string;
    version: number;
}

/**
 * Struttura della risposta JSON restituita da FireFly per una sanzione on-chain.
 */
export interface FireFlySanctionResponse {
    id: string;
    licenseRef: string;
    sanctionCommitment: string;
    issuedAt: string;
    inspectorRef: string;
    version: number;
}

/**
 * Contratto del servizio per le operazioni sul ledger immutabile Fabric.
 */
export interface BlockchainService {
    /**
     * Registra l'esistenza iniziale di una patente sul ledger con il suo primo commitment.
     * @param licenseRef Identificativo opaco della patente
     * @param initialCommitment Commitment Poseidon dello stato iniziale (30 crediti, ACTIVE, v1)
     */
    createLicense(licenseRef: string, initialCommitment: string): Promise<void>;

    /**
     * Recupera lo stato pubblico corrente di una patente dal ledger.
     * @param licenseRef Riferimento della patente
     * @returns Oggetto LicenseOnChain oppure null se non presente
     */
    getLicenseState(licenseRef: string): Promise<LicenseOnChain | null>;

    /**
     * Registra una sanzione e aggiorna atomicamente il commitment della patente on-chain.
     * @param params Dati e commitment della sanzione
     */
    issueSanction(params: IssueSanctionOnChainParams): Promise<void>;

    /**
     * Recupera i metadati pubblici di una specifica sanzione registrata sul ledger.
     * @param sanctionId Identificativo della sanzione
     * @returns Oggetto SanctionOnChain oppure null se non presente
     */
    getSanction(sanctionId: string): Promise<SanctionOnChain | null>;
}

/**
 * Implementazione concreta di BlockchainService basata sull'API REST di FireFly.
 */
export class BlockchainServiceImpl implements BlockchainService {
    constructor(private readonly fireflyClient: FireFlyClient) {}

    /**
     * Invoca il chaincode "CreateLicense" tramite FireFly.
     * @throws {Error} Se licenseRef o initialCommitment sono vuoti
     */
    async createLicense(
        licenseRef: string,
        initialCommitment: string,
    ): Promise<void> {
        if (!licenseRef || licenseRef.trim() === "") {
            throw new Error("License reference must not be empty");
        }
        if (!initialCommitment || initialCommitment.trim() === "") {
            throw new Error("Initial commitment must not be empty");
        }

        await this.fireflyClient.invoke("CreateLicense", {
            licenseRef: licenseRef.trim(),
            initialCommitment: initialCommitment.trim(),
        });
    }

    /**
     * Interroga il chaincode con "GetLicenseState" per ottenere il commitment registrato.
     * @throws {Error} Se licenseRef è vuoto
     */
    async getLicenseState(licenseRef: string): Promise<LicenseOnChain | null> {
        if (!licenseRef || licenseRef.trim() === "") {
            throw new Error("License reference must not be empty");
        }

        const response =
            await this.fireflyClient.query<FireFlyLicenseStateResponse | null>(
                "GetLicenseState",
                { licenseRef: licenseRef.trim() },
            );

        if (!response || !response.licenseRef) {
            return null;
        }

        return LicenseOnChain.fromLedger(response);
    }

    /**
     * Invoca il chaincode "IssueSanction" per ancorare la sanzione e avanzare la versione.
     * @throws {Error} Se i parametri forniti non sono validi o incompleti
     */
    async issueSanction(params: IssueSanctionOnChainParams): Promise<void> {
        if (!params || typeof params !== "object") {
            throw new Error("Sanction parameters must be an object");
        }
        if (!params.sanctionId || params.sanctionId.trim() === "") {
            throw new Error("Sanction ID must not be empty");
        }
        if (!params.licenseRef || params.licenseRef.trim() === "") {
            throw new Error("License reference must not be empty");
        }
        if (
            !params.sanctionCommitment ||
            params.sanctionCommitment.trim() === ""
        ) {
            throw new Error("Sanction commitment must not be empty");
        }
        if (!params.newCommitment || params.newCommitment.trim() === "") {
            throw new Error("New commitment must not be empty");
        }
        if (!params.inspectorRef || params.inspectorRef.trim() === "") {
            throw new Error("Inspector reference must not be empty");
        }

        await this.fireflyClient.invoke("IssueSanction", {
            sanctionID: params.sanctionId.trim(),
            licenseRef: params.licenseRef.trim(),
            sanctionCommitment: params.sanctionCommitment.trim(),
            newCommitment: params.newCommitment.trim(),
            inspectorRef: params.inspectorRef.trim(),
        });
    }

    /**
     * Interroga il chaincode con "GetSanction" per recuperare i dettagli pubblici della sanzione.
     * @throws {Error} Se sanctionId è vuoto
     */
    async getSanction(sanctionId: string): Promise<SanctionOnChain | null> {
        if (!sanctionId || sanctionId.trim() === "") {
            throw new Error("Sanction ID must not be empty");
        }

        const response =
            await this.fireflyClient.query<FireFlySanctionResponse | null>(
                "GetSanction",
                { sanctionID: sanctionId.trim() },
            );

        if (!response || !response.id) {
            return null;
        }

        return SanctionOnChain.fromLedger(response);
    }
}
