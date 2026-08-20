import { Sanction } from "../../../backend/src/domain/sanction.js";

describe("Sanction Domain Model", () => {
    it("should instantiate a valid sanction", () => {
        const now = new Date();
        const sanction = new Sanction({
            id: "SANC-001",
            penalty: 5,
            licenseId: "LIC-001",
            reason: "Mancato uso del casco",
            issuedAt: now,
            inspectorId: "INSP-01",
        });

        expect(sanction.id).toBe("SANC-001");
        expect(sanction.penalty).toBe(5);
        expect(sanction.licenseId).toBe("LIC-001");
        expect(sanction.reason).toBe("Mancato uso del casco");
        expect(sanction.issuedAt).toBe(now);
        expect(sanction.inspectorId).toBe("INSP-01");
    });

    it("should reject penalty <= 0 on creation", () => {
        expect(
            () =>
                new Sanction({
                    id: "SANC-001",
                    penalty: 0,
                    licenseId: "LIC-001",
                    reason: "Motivazione",
                    issuedAt: new Date(),
                    inspectorId: "INSP-01",
                }),
        ).toThrow("Penalty must be greater than 0");

        expect(
            () =>
                new Sanction({
                    id: "SANC-001",
                    penalty: -5,
                    licenseId: "LIC-001",
                    reason: "Motivazione",
                    issuedAt: new Date(),
                    inspectorId: "INSP-01",
                }),
        ).toThrow("Penalty must be greater than 0");
    });
});
