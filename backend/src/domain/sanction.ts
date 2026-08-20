// Un'interfaccia semplice che descrive solo i dati di input
interface SanctionData {
    id: string;
    penalty: number;
    licenseId: string;
    reason: string;
    issuedAt: Date;
    inspectorId: string;
}

export class Sanction {
    readonly id: string;
    readonly penalty: number;
    readonly licenseId: string;
    readonly reason: string;
    readonly issuedAt: Date;
    readonly inspectorId: string;

    constructor(data: SanctionData) {
        if (data.penalty <= 0) {
            throw new Error("Penalty must be greater than 0");
        }

        this.id = data.id;
        this.penalty = data.penalty;
        this.licenseId = data.licenseId;
        this.reason = data.reason;
        this.issuedAt = data.issuedAt;
        this.inspectorId = data.inspectorId;
    }
}