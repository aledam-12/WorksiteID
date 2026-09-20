import { Worker } from "../../../backend/src/domain/worker.js";

describe("Worker Domain Model", () => {
    const validWorkerData = {
        id: "WRK-001",
        name: "Mario",
        surname: "Rossi",
        cf: "RSSMRA80A01H501U",
        company: "Edilizia S.p.A.",
    };

    it("should instantiate a valid worker", () => {
        const worker = new Worker(validWorkerData);

        expect(worker.id).toBe("WRK-001");
        expect(worker.name).toBe("Mario");
        expect(worker.surname).toBe("Rossi");
        expect(worker.cf).toBe("RSSMRA80A01H501U");
        expect(worker.company).toBe("Edilizia S.p.A.");
    });

    it("should trim leading and trailing whitespace from all fields on creation", () => {
        const worker = new Worker({
            id: "  WRK-001  ",
            name: "  Mario  ",
            surname: "  Rossi  ",
            cf: "  RSSMRA80A01H501U  ",
            company: "  Edilizia S.p.A.  ",
        });

        expect(worker.id).toBe("WRK-001");
        expect(worker.name).toBe("Mario");
        expect(worker.surname).toBe("Rossi");
        expect(worker.cf).toBe("RSSMRA80A01H501U");
        expect(worker.company).toBe("Edilizia S.p.A.");
    });

    it("should reject an empty or whitespace-only ID", () => {
        expect(() => new Worker({ ...validWorkerData, id: "" })).toThrow("Worker ID must not be empty");
        expect(() => new Worker({ ...validWorkerData, id: "   " })).toThrow("Worker ID must not be empty");
    });

    it("should reject an empty or whitespace-only name on creation and update", () => {
        expect(() => new Worker({ ...validWorkerData, name: "" })).toThrow("Worker name must not be empty");
        expect(() => new Worker({ ...validWorkerData, name: "   " })).toThrow("Worker name must not be empty");

        const worker = new Worker(validWorkerData);
        expect(() => {
            worker.name = "";
        }).toThrow("Worker name must not be empty");
        expect(() => {
            worker.name = "   ";
        }).toThrow("Worker name must not be empty");
    });

    it("should reject an empty or whitespace-only surname on creation and update", () => {
        expect(() => new Worker({ ...validWorkerData, surname: "" })).toThrow("Worker surname must not be empty");
        expect(() => new Worker({ ...validWorkerData, surname: "   " })).toThrow("Worker surname must not be empty");

        const worker = new Worker(validWorkerData);
        expect(() => {
            worker.surname = "";
        }).toThrow("Worker surname must not be empty");
        expect(() => {
            worker.surname = "   ";
        }).toThrow("Worker surname must not be empty");
    });

    it("should reject an empty or whitespace-only CF on creation and update", () => {
        expect(() => new Worker({ ...validWorkerData, cf: "" })).toThrow("Worker CF must not be empty");
        expect(() => new Worker({ ...validWorkerData, cf: "   " })).toThrow("Worker CF must not be empty");

        const worker = new Worker(validWorkerData);
        expect(() => {
            worker.cf = "";
        }).toThrow("Worker CF must not be empty");
        expect(() => {
            worker.cf = "   ";
        }).toThrow("Worker CF must not be empty");
    });

    it("should reject an empty or whitespace-only company on creation and update", () => {
        expect(() => new Worker({ ...validWorkerData, company: "" })).toThrow("Worker company must not be empty");
        expect(() => new Worker({ ...validWorkerData, company: "   " })).toThrow("Worker company must not be empty");

        const worker = new Worker(validWorkerData);
        expect(() => {
            worker.company = "";
        }).toThrow("Worker company must not be empty");
        expect(() => {
            worker.company = "   ";
        }).toThrow("Worker company must not be empty");
    });

    it("should correctly update and trim fields via setters", () => {
        const worker = new Worker(validWorkerData);

        worker.name = "  Luigi  ";
        worker.surname = "  Bianchi  ";
        worker.cf = "  BNCLGU85B02H501Z  ";
        worker.company = "  Costruzioni S.r.l.  ";

        expect(worker.name).toBe("Luigi");
        expect(worker.surname).toBe("Bianchi");
        expect(worker.cf).toBe("BNCLGU85B02H501Z");
        expect(worker.company).toBe("Costruzioni S.r.l.");
    });
});
