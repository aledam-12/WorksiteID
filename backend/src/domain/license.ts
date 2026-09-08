import { Sanction } from "./sanction.js";

export enum LicenseStatusEnum {
    ACTIVE = "ACTIVE",
    REVOKED = "REVOKED",
}

export class License {
    readonly #id: string;
    #licenseStatus: LicenseStatusEnum;
    #credits: number;
    #sanctions: Sanction[];

    constructor(id: string) {
        if (!id || id.trim() === "") {
            throw new Error("License ID must not be empty");
        }
        this.#id = id.trim();
        this.#credits = 30;
        this.#licenseStatus = LicenseStatusEnum.ACTIVE;
        this.#sanctions = [];
    }

    static fromLedger(data: { id: string; credits: number; status: string }): License {
        if (!data || typeof data !== "object") {
            throw new Error("Ledger data must be an object");
        }
        if (!Object.values(LicenseStatusEnum).includes(data.status as LicenseStatusEnum)) {
            throw new Error(`Invalid license status: ${data.status}`);
        }
        const license = new License(data.id);
        license.#credits = data.credits;
        license.#licenseStatus = data.status as LicenseStatusEnum;
        return license;
    }

    get id(): string {
        return this.#id;
    }

    get licenseStatus(): LicenseStatusEnum {
        return this.#licenseStatus;
    }

    get credits(): number {
        return this.#credits;
    }

    get sanctions(): Sanction[] {
        return [...this.#sanctions];
    }

    applySanction(sanction: Sanction): void {
        this.#credits = Math.max(0, this.#credits - sanction.penalty);
        if (this.#credits < 15) {
            this.#licenseStatus = LicenseStatusEnum.REVOKED;
        }
        this.#sanctions.push(sanction);
    }
}