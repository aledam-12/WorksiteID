import { LicenseOnChain } from "../domain/license-on-chain.js";
import { SanctionOnChain } from "../domain/sanction-on-chain.js";
import { FireFlyClient } from "./firefly-client.js";

export interface IssueSanctionOnChainParams {
    sanctionId: string;
    licenseRef: string;
    sanctionCommitment: string;
    newCommitment: string;
    inspectorRef: string;
}

export interface FireFlyLicenseStateResponse {
    licenseRef: string;
    commitment: string;
    version: number;
}

export interface FireFlySanctionResponse {
    id: string;
    licenseRef: string;
    sanctionCommitment: string;
    issuedAt: string;
    inspectorRef: string;
    version: number;
}

export interface BlockchainService {
    createLicense(licenseRef: string, initialCommitment: string): Promise<void>;
    getLicenseState(licenseRef: string): Promise<LicenseOnChain | null>;
    issueSanction(params: IssueSanctionOnChainParams): Promise<void>;
    getSanction(sanctionId: string): Promise<SanctionOnChain | null>;
}

export class BlockchainServiceImpl implements BlockchainService {
    constructor(private readonly fireflyClient: FireFlyClient) {}

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
