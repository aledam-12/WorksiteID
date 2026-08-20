import { Worker } from "../domain/worker.js";
import { Inspector } from "../domain/inspector.js";
import { WorkerRepository } from "../repositories/worker-repository.js";
import { InspectorRepository } from "../repositories/inspector-repository.js";


interface IdentityService {
    registerWorker(worker: Worker): Promise<void>
    getWorkerById(id: string): Promise<Worker | null>

    registerInspector(inspector: Inspector): Promise<void>
    getInspectorById(id: string): Promise<Inspector | null>
}
class IdentityServiceImpl implements IdentityService {
    constructor(
        private readonly workerRepository: WorkerRepository,
        private readonly inspectorRepository: InspectorRepository,
    ) { }

    async registerWorker(worker: Worker): Promise<void> {
        await this.workerRepository.register(worker);
    }

    async getWorkerById(id: string): Promise<Worker | null> {
        return this.workerRepository.findById(id);
    }

    async registerInspector(inspector: Inspector): Promise<void> {
        await this.inspectorRepository.register(inspector);
    }

    async getInspectorById(id: string): Promise<Inspector | null> {
        return this.inspectorRepository.findById(id);
    }
}

export { IdentityService, IdentityServiceImpl }