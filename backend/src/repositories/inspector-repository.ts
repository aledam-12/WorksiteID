import { Inspector } from "../domain/inspector.js";

export interface InspectorRepository {
    register(inspector: Inspector): Promise<void>;
    findById(id: string): Promise<Inspector | null>;
    existsById(id: string): Promise<boolean>;
}

export class InMemoryInspectorRepository implements InspectorRepository {
    private inspectors: Map<string, Inspector> = new Map();

    async register(inspector: Inspector): Promise<void> {
        if (await this.existsById(inspector.id)) throw new Error("Inspector already exists");
        this.inspectors.set(inspector.id, inspector);
    }

    async findById(id: string): Promise<Inspector | null> {
        return this.inspectors.get(id) ?? null;
    }

    async existsById(id: string): Promise<boolean> {
        return this.inspectors.has(id);
    }
}