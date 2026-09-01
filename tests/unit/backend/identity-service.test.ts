import {
    IdentityService,
    IdentityServiceImpl,
} from "../../../backend/src/services/identity-service.js";
import { WorkerRepository } from "../../../backend/src/repositories/worker-repository.js";
import { InspectorRepository } from "../../../backend/src/repositories/inspector-repository.js";
import { Worker } from "../../../backend/src/domain/worker.js";
import { Inspector } from "../../../backend/src/domain/inspector.js";
import { WebAuthnUserType } from "../../../backend/src/domain/webauthn-credentials.js";

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

    describe("exists and findById operations", () => {
        const worker = new Worker({
            id: "WRK-001",
            name: "Mario",
            surname: "Rossi",
            cf: "RSSMRA80A01H501U",
            company: "Edilizia S.p.A.",
            licenseId: "LIC-001",
        });
        const inspector = new Inspector("INSP-001");

        it("should return true when Worker exists", async () => {
            workerRepository.findById.mockResolvedValue(worker);

            const exists = await identityService.exists(
                "WRK-001",
                WebAuthnUserType.WORKER,
            );
            const found = await identityService.findById(
                "WRK-001",
                WebAuthnUserType.WORKER,
            );

            expect(exists).toBe(true);
            expect(found).toBe(worker);
            expect(workerRepository.findById).toHaveBeenCalledWith("WRK-001");
        });

        it("should return false when Worker does not exist", async () => {
            workerRepository.findById.mockResolvedValue(null);

            const exists = await identityService.exists(
                "WRK-999",
                WebAuthnUserType.WORKER,
            );
            const found = await identityService.findById(
                "WRK-999",
                WebAuthnUserType.WORKER,
            );

            expect(exists).toBe(false);
            expect(found).toBeNull();
            expect(workerRepository.findById).toHaveBeenCalledWith("WRK-999");
        });

        it("should return true when Inspector exists", async () => {
            inspectorRepository.findById.mockResolvedValue(inspector);

            const exists = await identityService.exists(
                "INSP-001",
                WebAuthnUserType.INSPECTOR,
            );
            const found = await identityService.findById(
                "INSP-001",
                WebAuthnUserType.INSPECTOR,
            );

            expect(exists).toBe(true);
            expect(found).toBe(inspector);
            expect(inspectorRepository.findById).toHaveBeenCalledWith("INSP-001");
        });

        it("should return false when Inspector does not exist", async () => {
            inspectorRepository.findById.mockResolvedValue(null);

            const exists = await identityService.exists(
                "INSP-999",
                WebAuthnUserType.INSPECTOR,
            );
            const found = await identityService.findById(
                "INSP-999",
                WebAuthnUserType.INSPECTOR,
            );

            expect(exists).toBe(false);
            expect(found).toBeNull();
            expect(inspectorRepository.findById).toHaveBeenCalledWith("INSP-999");
        });

        it("should return false when a Worker ID is queried as Inspector", async () => {
            workerRepository.findById.mockResolvedValue(worker);
            inspectorRepository.findById.mockResolvedValue(null);

            const exists = await identityService.exists(
                "WRK-001",
                WebAuthnUserType.INSPECTOR,
            );
            const found = await identityService.findById(
                "WRK-001",
                WebAuthnUserType.INSPECTOR,
            );

            expect(exists).toBe(false);
            expect(found).toBeNull();
            expect(inspectorRepository.findById).toHaveBeenCalledWith("WRK-001");
            expect(workerRepository.findById).not.toHaveBeenCalled();
        });

        it("should return false when an Inspector ID is queried as Worker", async () => {
            inspectorRepository.findById.mockResolvedValue(inspector);
            workerRepository.findById.mockResolvedValue(null);

            const exists = await identityService.exists(
                "INSP-001",
                WebAuthnUserType.WORKER,
            );
            const found = await identityService.findById(
                "INSP-001",
                WebAuthnUserType.WORKER,
            );

            expect(exists).toBe(false);
            expect(found).toBeNull();
            expect(workerRepository.findById).toHaveBeenCalledWith("INSP-001");
            expect(inspectorRepository.findById).not.toHaveBeenCalled();
        });
    });
});

