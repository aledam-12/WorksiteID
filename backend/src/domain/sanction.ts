export interface SanctionData {
    id: string;
    penalty: number;
    licenseRef?: string;
    licenseId?: string;
    reason: string;
    issuedAt: Date;
    inspectorRef?: string;
    inspectorId?: string;
    randomness?: string;
}

export class Sanction {
    readonly id: string;
    readonly penalty: number;
    readonly licenseRef: string;
    readonly reason: string;
    readonly issuedAt: Date;
    readonly inspectorRef: string;
    readonly randomness: string;

    constructor(data: SanctionData) {
        if (!data.id || data.id.trim() === "") {
            throw new Error("Sanction ID cannot be empty");
        }

        if (data.penalty <= 0) {
            throw new Error("Penalty must be greater than 0");
        }

        const ref = data.licenseRef ?? data.licenseId;
        if (!ref || ref.trim() === "") {
            throw new Error("License reference cannot be empty");
        }

        if (!data.reason || data.reason.trim() === "") {
            throw new Error("Reason cannot be empty");
        }

        const inspRef = data.inspectorRef ?? data.inspectorId;
        if (!inspRef || inspRef.trim() === "") {
            throw new Error("Inspector reference cannot be empty");
        }

        this.id = data.id.trim();
        this.penalty = data.penalty;
        this.licenseRef = ref.trim();
        this.reason = data.reason.trim();
        this.issuedAt = data.issuedAt;
        this.inspectorRef = inspRef.trim();
        this.randomness = data.randomness ?? "";
    }

    get sanctionId(): string {
        return this.id;
    }

    get licenseId(): string {
        return this.licenseRef;
    }

    get inspectorId(): string {
        return this.inspectorRef;
    }
}