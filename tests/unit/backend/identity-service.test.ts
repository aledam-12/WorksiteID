import {
    IdentityService,
    IdentityServiceImpl,
} from "../../../backend/src/services/identity-service.js";
import { WorkerRepository } from "../../../backend/src/repositories/worker-repository.js";
import { InspectorRepository } from "../../../backend/src/repositories/inspector-repository.js";
import { Worker } from "../../../backend/src/domain/worker.js";
import { Inspector } from "../../../backend/src/domain/inspector.js";

describe("IdentityService", () => {
    let workerRepository: jest.Mocked<WorkerRepository>;
    let inspectorRepository: jest.Mocked<InspectorRepository>;
    let identityService: IdentityService;

    beforeEach(() => {
        workerRepository = {
            register: jest.fn(),
            findById: jest.fn(),
            existsById: jest.fn(),
        };

        inspectorRepository = {
            register: jest.fn(),
            findById: jest.fn(),
            existsById: jest.fn(),
        };

        identityService = new IdentityServiceImpl(
            workerRepository,
            inspectorRepository,
        );
    });

    describe("Worker operations", () => {
        const worker = new Worker({
            id: "WRK-001",
            name: "Mario",
            surname: "Rossi",
            cf: "RSSMRA80A01H501U",
            company: "Edilizia S.p.A.",
            licenseId: "LIC-001",
        });

        it("should register a worker through the repository", async () => {
            await identityService.registerWorker(worker);

            expect(workerRepository.register).toHaveBeenCalledTimes(1);
            expect(workerRepository.register).toHaveBeenCalledWith(worker);
        });

        it("should retrieve a worker through the repository", async () => {
            workerRepository.findById.mockResolvedValue(worker);

            const result = await identityService.getWorkerById("WRK-001");

            expect(workerRepository.findById).toHaveBeenCalledTimes(1);
            expect(workerRepository.findById).toHaveBeenCalledWith("WRK-001");
            expect(result).toBe(worker);
        });

        it("should return null when the worker is not found", async () => {
            workerRepository.findById.mockResolvedValue(null);

            const result =
                await identityService.getWorkerById("WRK-999");

            expect(workerRepository.findById).toHaveBeenCalledWith(
                "WRK-999",
            );
            expect(result).toBeNull();
        });
    });

    describe("Inspector operations", () => {
        const inspector = new Inspector("INSP-001");

        it("should register an inspector through the repository", async () => {
            await identityService.registerInspector(inspector);

            expect(inspectorRepository.register).toHaveBeenCalledTimes(1);
            expect(inspectorRepository.register).toHaveBeenCalledWith(
                inspector,
            );
        });

        it("should retrieve an inspector through the repository", async () => {
            inspectorRepository.findById.mockResolvedValue(inspector);

            const result =
                await identityService.getInspectorById("INSP-001");

            expect(inspectorRepository.findById).toHaveBeenCalledTimes(1);
            expect(inspectorRepository.findById).toHaveBeenCalledWith(
                "INSP-001",
            );
            expect(result).toBe(inspector);
        });

        it("should return null when the inspector is not found", async () => {
            inspectorRepository.findById.mockResolvedValue(null);

            const result =
                await identityService.getInspectorById("INSP-999");

            expect(inspectorRepository.findById).toHaveBeenCalledWith(
                "INSP-999",
            );
            expect(result).toBeNull();
        });
    });
});
