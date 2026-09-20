export interface WorkerData {
    id: string;
    name: string;
    surname: string;
    cf: string;
    company: string;
    licenseId?: string;
}

/**
 * Modello di dominio del lavoratore (Worker).
 * In MySQL la relazione autorevole è memorizzata in private_licenses.worker_id.
 * La proprietà opzionale licenseId è mantenuta per retrocompatibilità con i test
 * e i contesti in-memory.
 */
export class Worker {
    readonly #id: string;
    #name!: string;
    #surname!: string;
    #cf!: string;
    #company!: string;
    #licenseId: string | undefined;

    constructor(data: WorkerData) {
        this.#id = this.#validate(data.id, "Worker ID must not be empty");
        this.name = data.name;
        this.surname = data.surname;
        this.cf = data.cf;
        this.company = data.company;
        if (data.licenseId !== undefined) {
            this.licenseId = data.licenseId;
        }
    }

    #validate(value: string, errorMessage: string): string {
        if (!value || value.trim() === "") {
            throw new Error(errorMessage);
        }
        return value.trim();
    }

    get id(): string {
        return this.#id;
    }

    get name(): string {
        return this.#name;
    }

    get surname(): string {
        return this.#surname;
    }

    get cf(): string {
        return this.#cf;
    }

    get company(): string {
        return this.#company;
    }

    get licenseId(): string | undefined {
        return this.#licenseId;
    }

    set name(name: string) {
        this.#name = this.#validate(name, "Worker name must not be empty");
    }

    set surname(surname: string) {
        this.#surname = this.#validate(surname, "Worker surname must not be empty");
    }

    set cf(cf: string) {
        this.#cf = this.#validate(cf, "Worker CF must not be empty");
    }

    set company(company: string) {
        this.#company = this.#validate(company, "Worker company must not be empty");
    }

    set licenseId(licenseId: string | undefined) {
        if (licenseId !== undefined) {
            this.#licenseId = this.#validate(licenseId, "Worker license ID must not be empty");
        } else {
            this.#licenseId = undefined;
        }
    }
}