import { Worker } from "../domain/worker.js";
import { Inspector } from "../domain/inspector.js";
import { WorkerRepository } from "../repositories/worker-repository.js";
import { InspectorRepository } from "../repositories/inspector-repository.js";
import { WebAuthnUserType } from "../domain/webauthn-credentials.js";


interface IdentityService {
    registerWorker(worker: Worker): Promise<void>
    getWorkerById(id: string): Promise<Worker | null>

    registerInspector(inspector: Inspector): Promise<void>
    getInspectorById(id: string): Promise<Inspector | null>
    exists(id: string, userType: WebAuthnUserType): Promise<boolean>
    findById(id: string, userType: WebAuthnUserType): Promise<Worker | Inspector | null>
}
class IdentityServiceImpl implements IdentityService {
    constructor(
        private readonly workerRepository: WorkerRepository,
        private readonly inspectorRepository: InspectorRepository,
    ) { }
    async findById(id: string, userType: WebAuthnUserType): Promise<Worker | Inspector | null> {
        if (userType === WebAuthnUserType.WORKER) {
            return this.getWorkerById(id);
        } else {
            return this.getInspectorById(id);
        }
    }

    async exists(id: string, userType: WebAuthnUserType): Promise<boolean> {
        return (await this.findById(id, userType)) !== null;
    }

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