import { InMemoryWorkerRepository, WorkerRepository } from "../../../backend/src/repositories/worker-repository.js";
import { Worker } from "../../../backend/src/domain/worker.js";

describe("worker repository", () => {
    let repository: WorkerRepository;
    beforeEach(() => {
        repository = new InMemoryWorkerRepository();
    })
    it("should create a new worker", async () => {
        const worker = new Worker({
            id: "WRK-001",
            name: "Mario",
            surname: "Rossi",
            cf: "RSSMRA80A01H501U",
            company: "Edilizia S.p.A.",
            licenseId: "LIC-001",
        })
        await repository.register(worker);
        expect(await repository.findById(worker.id)).toEqual(worker);
        expect(await repository.existsById(worker.id)).toBe(true);
        await expect(repository.register(worker)).rejects.toThrow("Worker already exists");
    })
    it("should find a worker by id", async () => {
        const worker = new Worker({
            id: "WRK-001",
            name: "Mario",
            surname: "Rossi",
            cf: "RSSMRA80A01H501U",
            company: "Edilizia S.p.A.",
            licenseId: "LIC-001",
        })
        await repository.register(worker);
        expect(await repository.findById(worker.id)).toEqual(worker);
        expect(await repository.existsById(worker.id)).toBe(true);
    })
    it("should check if a worker exists by id", async () => {
        const worker = new Worker({
            id: "WRK-001",
            name: "Mario",
            surname: "Rossi",
            cf: "RSSMRA80A01H501U",
            company: "Edilizia S.p.A.",
            licenseId: "LIC-001",
        })
        await repository.register(worker);
        expect(await repository.findById(worker.id)).toEqual(worker);
        expect(await repository.existsById(worker.id)).toBe(true);
    })
    it("should return null when no worker is found", async () => {
        const worker = new Worker({
            id: "WRK-001",
            name: "Mario",
            surname: "Rossi",
            cf: "RSSMRA80A01H501U",
            company: "Edilizia S.p.A.",
            licenseId: "LIC-001",
        })
        await repository.register(worker);
        expect(await repository.existsById(worker.id)).toBe(true);
        expect(await repository.findById("WRK-002")).toBeNull();
    })
    it("should reject duplicate worker ids", async () => {
        const worker1 = new Worker({
            id: "WRK-001",
            name: "Mario",
            surname: "Rossi",
            cf: "RSSMRA80A01H501U",
            company: "Edilizia S.p.A.",
            licenseId: "LIC-001",
        });
        const worker2 = new Worker({
            id: "WRK-001",
            name: "Luigi",
            surname: "Verdi",
            cf: "VRDLGU80A01H501K",
            company: "Costruzioni S.r.l.",
            licenseId: "LIC-002",
        });
        await repository.register(worker1);
        await expect(repository.register(worker2)).rejects.toThrow("Worker already exists");
    });
});