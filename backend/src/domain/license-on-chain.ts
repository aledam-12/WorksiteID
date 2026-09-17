export interface LicenseOnChainData {
    licenseRef: string;
    commitment: string;
    version: number;
}

export class LicenseOnChain {
    public readonly licenseRef: string;
    public readonly commitment: string;
    public readonly version: number;

    constructor(
        licenseRef: string,
        commitment: string,
        version: number,
    ) {
        if (
            licenseRef === null ||
            licenseRef === undefined ||
            typeof licenseRef !== "string" ||
            licenseRef.trim() === ""
        ) {
            throw new Error("License reference cannot be empty");
        }

        if (
            commitment === null ||
            commitment === undefined ||
            typeof commitment !== "string" ||
            commitment.trim() === ""
        ) {
            throw new Error("Commitment cannot be empty");
        }

        if (
            version === null ||
            version === undefined ||
            typeof version !== "number" ||
            !Number.isInteger(version) ||
            version < 1
        ) {
            throw new Error(
                "Version must be an integer greater than or equal to 1",
            );
        }

        this.licenseRef = licenseRef.trim();
        this.commitment = commitment.trim();
        this.version = version;
    }

    static fromLedger(data: LicenseOnChainData): LicenseOnChain {
        if (!data || typeof data !== "object") {
            throw new Error("Ledger data must be an object");
        }
        return new LicenseOnChain(
            data.licenseRef,
            data.commitment,
            data.version,
        );
    }
}
