import { License } from "../domain/license.js";
import { Sanction } from "../domain/sanction.js";
import { FireFlyClient } from "./firefly-client.js";

export interface IssueSanctionParams {
    sanctionId: string;
    licenseId: string;
    inspectorId: string;
    penalty: number;
    reason: string;
    issuedAt: Date | string;
}

export interface FireFlyLicenseResponse {
    id: string;
    credits: number;
    status: string;
}

export interface FireFlySanctionResponse {
    id: string;
    licenseId: string;
    penalty: number;
    reason: string;
    issuedAt: string;
    inspectorId: string;
}

export interface BlockchainService {
    createLicense(licenseId: string, credits: number): Promise<void>;
    getLicense(licenseId: string): Promise<License | null>;
    issueSanction(params: IssueSanctionParams): Promise<void>;
    getSanction(sanctionId: string): Promise<Sanction | null>;
}

export class BlockchainServiceImpl implements BlockchainService {
    constructor(private readonly fireflyClient: FireFlyClient) {}

    async createLicense(licenseId: string, credits: number): Promise<void> {
        if (!licenseId || licenseId.trim() === "") {
            throw new Error("License ID must not be empty");
        }
        if (credits === undefined || credits === null || typeof credits !== "number" || Number.isNaN(credits)) {
            throw new Error("Credits must be a valid number");
        }

        await this.fireflyClient.invoke("CreateLicense", {
            licenseID: licenseId.trim(),
            credits,
        });
    }

    async getLicense(licenseId: string): Promise<License | null> {
        if (!licenseId || licenseId.trim() === "") {
            throw new Error("License ID must not be empty");
        }

        const response = await this.fireflyClient.query<FireFlyLicenseResponse | null>(
            "GetLicense",
            { licenseID: licenseId.trim() },
        );

        if (!response || !response.id) {
            return null;
        }

        return License.fromLedger(response);
    }

    async issueSanction(params: IssueSanctionParams): Promise<void> {
        if (!params.sanctionId || params.sanctionId.trim() === "") {
            throw new Error("Sanction ID must not be empty");
        }
        if (!params.licenseId || params.licenseId.trim() === "") {
            throw new Error("License ID must not be empty");
        }
        if (!params.inspectorId || params.inspectorId.trim() === "") {
            throw new Error("Inspector ID must not be empty");
        }

        let date: Date;
        if (params.issuedAt instanceof Date) {
            date = params.issuedAt;
        } else if (typeof params.issuedAt === "string" && params.issuedAt.trim() !== "") {
            date = new Date(params.issuedAt);
        } else {
            throw new Error("issuedAt must be a valid Date or ISO date string");
        }

        if (Number.isNaN(date.getTime())) {
            throw new Error("issuedAt must be a valid Date");
        }

        await this.fireflyClient.invoke("IssueSanction", {
            sanctionID: params.sanctionId.trim(),
            licenseID: params.licenseId.trim(),
            inspectorID: params.inspectorId.trim(),
            penalty: params.penalty,
            reason: params.reason ?? "",
            issuedAt: date.toISOString(),
        });
    }

    async getSanction(sanctionId: string): Promise<Sanction | null> {
        if (!sanctionId || sanctionId.trim() === "") {
            throw new Error("Sanction ID must not be empty");
        }

        const response = await this.fireflyClient.query<FireFlySanctionResponse | null>(
            "GetSanction",
            { sanctionID: sanctionId.trim() },
        );

        if (!response || !response.id) {
            return null;
        }

        return new Sanction({
            id: response.id,
            licenseId: response.licenseId,
            penalty: response.penalty,
            reason: response.reason,
            issuedAt: new Date(response.issuedAt),
            inspectorId: response.inspectorId,
        });
    }
}
