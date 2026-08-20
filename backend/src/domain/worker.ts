interface WorkerData {
    id: string;
    name: string;
    surname: string;
    cf: string;
    company: string;
    licenseId: string;
}

export class Worker {
    readonly #id: string;
    #name!: string;
    #surname!: string;
    #cf!: string;
    #company!: string;
    #licenseId!: string;

    constructor(data: WorkerData) {
        this.#id = this.#validate(data.id, "Worker ID must not be empty");
        this.name = data.name;
        this.surname = data.surname;
        this.cf = data.cf;
        this.company = data.company;
        this.licenseId = data.licenseId;
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

    get licenseId(): string {
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

    set licenseId(licenseId: string) {
        this.#licenseId = this.#validate(licenseId, "Worker license ID must not be empty");
    }
}