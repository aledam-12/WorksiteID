import { Worker } from "../../../backend/src/domain/worker.js";

describe("Worker Domain Model", () => {
    it("should instantiate a valid worker", () => {
        const worker = new Worker({
            id: "WRK-001",
            name: "Mario",
            surname: "Rossi",
            cf: "RSSMRA80A01H501U",
            company: "Edilizia S.p.A.",
            licenseId: "LIC-001",
        });

        expect(worker.id).toBe("WRK-001");
        expect(worker.name).toBe("Mario");
        expect(worker.surname).toBe("Rossi");
        expect(worker.cf).toBe("RSSMRA80A01H501U");
        expect(worker.company).toBe("Edilizia S.p.A.");
        expect(worker.licenseId).toBe("LIC-001");
    });
});
