import { Worker } from "../domain/worker.js";

export interface WorkerRepository {
    register(worker: Worker): Promise<void>;
    findById(id: string): Promise<Worker | null>;
    existsById(id: string): Promise<boolean>;
}

export class InMemoryWorkerRepository implements WorkerRepository {
    private workers: Map<string, Worker> = new Map();

    async register(worker: Worker): Promise<void> {
        if (await this.existsById(worker.id)) throw new Error("Worker already exists");
        this.workers.set(worker.id, worker);
    }

    async findById(id: string): Promise<Worker | null> {
        return this.workers.get(id) ?? null;
    }

    async existsById(id: string): Promise<boolean> {
        return this.workers.has(id);
    }
}