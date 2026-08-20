interface WorkerData {
    id: string;
    name: string;
    surname: string;
    cf: string;
    company: string;
    licenseId: string;
}

export class Worker {
    #id: string;
    #name: string;
    #surname: string;
    #cf: string;
    #company: string;
    #licenseId: string;

    constructor(data: WorkerData) {
        this.#id = data.id;
        this.#name = data.name;
        this.#surname = data.surname;
        this.#cf = data.cf;
        this.#company = data.company;
        this.#licenseId = data.licenseId;
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
        this.#name = name;
    }

    set surname(surname: string) {
        this.#surname = surname;
    }

    set cf(cf: string) {
        this.#cf = cf;
    }

    set company(company: string) {
        this.#company = company;
    }

    set licenseId(licenseId: string) {
        this.#licenseId = licenseId;
    }
}