export interface SanctionOnChainData {
    id: string;
    licenseRef: string;
    sanctionCommitment: string;
    issuedAt: Date | string;
    inspectorRef: string;
    version: number;
}

export class SanctionOnChain {
    public readonly id: string;
    public readonly licenseRef: string;
    public readonly sanctionCommitment: string;
    public readonly issuedAt: Date;
    public readonly inspectorRef: string;
    public readonly version: number;

    constructor(data: SanctionOnChainData) {
        if (!data || typeof data !== "object") {
            throw new Error("Sanction on-chain data must be an object");
        }

        if (
            data.id === null ||
            data.id === undefined ||
            typeof data.id !== "string" ||
            data.id.trim() === ""
        ) {
            throw new Error("Sanction ID cannot be empty");
        }

        if (
            data.licenseRef === null ||
            data.licenseRef === undefined ||
            typeof data.licenseRef !== "string" ||
            data.licenseRef.trim() === ""
        ) {
            throw new Error("License reference cannot be empty");
        }

        if (
            data.sanctionCommitment === null ||
            data.sanctionCommitment === undefined ||
            typeof data.sanctionCommitment !== "string" ||
            data.sanctionCommitment.trim() === ""
        ) {
            throw new Error("Sanction commitment cannot be empty");
        }

        let parsedDate: Date;
        if (data.issuedAt instanceof Date) {
            parsedDate = data.issuedAt;
        } else if (
            typeof data.issuedAt === "string" &&
            data.issuedAt.trim() !== ""
        ) {
            parsedDate = new Date(data.issuedAt);
        } else {
            throw new Error("IssuedAt must be a valid Date or ISO date string");
        }

        if (Number.isNaN(parsedDate.getTime())) {
            throw new Error("IssuedAt must be a valid Date");
        }

        if (
            data.inspectorRef === null ||
            data.inspectorRef === undefined ||
            typeof data.inspectorRef !== "string" ||
            data.inspectorRef.trim() === ""
        ) {
            throw new Error("Inspector reference cannot be empty");
        }

        if (
            data.version === null ||
            data.version === undefined ||
            typeof data.version !== "number" ||
            !Number.isInteger(data.version) ||
            data.version < 1
        ) {
            throw new Error(
                "Version must be an integer greater than or equal to 1",
            );
        }

        this.id = data.id.trim();
        this.licenseRef = data.licenseRef.trim();
        this.sanctionCommitment = data.sanctionCommitment.trim();
        this.issuedAt = parsedDate;
        this.inspectorRef = data.inspectorRef.trim();
        this.version = data.version;
    }

    static fromLedger(data: SanctionOnChainData): SanctionOnChain {
        return new SanctionOnChain(data);
    }
}
