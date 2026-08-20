export class Inspector {
    #id: string;

    get id(): string {
        return this.#id;
    }

    constructor(id: string) {
        this.#id = this.validateId(id);
    }

    private validateId(id: string): string {
        id = id.trim();
        if (id.length === 0) {
            throw new Error("Inspector ID must be a non-empty string.");
        }
        return id;
    }
    toString(): string {
        return this.#id;
    }
}