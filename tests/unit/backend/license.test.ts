import { License, LicenseStatusEnum } from "../../../backend/src/domain/license.js";
import { Sanction } from "../../../backend/src/domain/sanction.js";

describe("License Domain Model", () => {
    it("should initialize a new license with 30 credits, ACTIVE status, and empty sanctions", () => {
        const license = new License("LIC-001");

        expect(license.id).toBe("LIC-001");
        expect(license.credits).toBe(30);
        expect(license.licenseStatus).toBe(LicenseStatusEnum.ACTIVE);
        expect(license.sanctions).toEqual([]);
    });

    it("should reject an empty or whitespace-only license ID", () => {
        expect(() => new License("")).toThrow("License ID must not be empty");
        expect(() => new License("   ")).toThrow("License ID must not be empty");
    });

    it("should apply a sanction and reduce credits while remaining ACTIVE if credits >= 15", () => {
        const license = new License("LIC-001");
        const sanction = new Sanction({
            id: "SANC-001",
            penalty: 5,
            licenseId: "LIC-001",
            reason: "Mancato uso DPI",
            issuedAt: new Date(),
            inspectorId: "INSP-01",
        });

        license.applySanction(sanction);

        expect(license.credits).toBe(25);
        expect(license.licenseStatus).toBe(LicenseStatusEnum.ACTIVE);
        expect(license.sanctions).toHaveLength(1);
        expect(license.sanctions[0]).toBe(sanction);
    });

    it("should change status to REVOKED when credits drop below 15", () => {
        const license = new License("LIC-001");
        const sanction = new Sanction({
            id: "SANC-001",
            penalty: 16,
            licenseId: "LIC-001",
            reason: "Grave violazione sicurezza",
            issuedAt: new Date(),
            inspectorId: "INSP-01",
        });

        license.applySanction(sanction);

        expect(license.credits).toBe(14);
        expect(license.licenseStatus).toBe(LicenseStatusEnum.REVOKED);
    });

    it("should not allow credits to drop below 0", () => {
        const license = new License("LIC-001");
        const sanction = new Sanction({
            id: "SANC-001",
            penalty: 50,
            licenseId: "LIC-001",
            reason: "Violazione gravissima",
            issuedAt: new Date(),
            inspectorId: "INSP-01",
        });

        license.applySanction(sanction);

        expect(license.credits).toBe(0);
        expect(license.licenseStatus).toBe(LicenseStatusEnum.REVOKED);
    });

    it("should protect the internal sanctions array against direct mutation via the getter", () => {
        const license = new License("LIC-001");
        const sanction = new Sanction({
            id: "SANC-001",
            penalty: 5,
            licenseId: "LIC-001",
            reason: "Mancato uso DPI",
            issuedAt: new Date(),
            inspectorId: "INSP-01",
        });

        const sanctionsList = license.sanctions;
        sanctionsList.push(sanction);

        expect(license.sanctions).toHaveLength(0);
    });
    it("license should stay active when credits reach exactly 15 points sanctions", () => {
        const license = new License("LIC-001");
        const sanction = new Sanction({
            id: "SANC-001",
            penalty: 15,
            licenseId: "LIC-001",
            reason: "Mancato uso DPI",
            issuedAt: new Date(),
            inspectorId: "INSP-01",
        });
        license.applySanction(sanction);
        expect(license.licenseStatus).toBe(LicenseStatusEnum.ACTIVE);
    });
    it("REVOKED license doesn't return ACTIVE", () => {
        const license = new License("LIC-001");
        const sanction1 = new Sanction({
            id: "SANC-001",
            penalty: 5,
            licenseId: "LIC-001",
            reason: "Mancato uso DPI",
            issuedAt: new Date(),
            inspectorId: "INSP-01",
        });
        license.applySanction(sanction1);
        expect(license.licenseStatus).toBe(LicenseStatusEnum.ACTIVE);
        const sanction2 = new Sanction({
            id: "SANC-002",
            penalty: 12,
            licenseId: "LIC-001",
            reason: "Mancato uso DPI",
            issuedAt: new Date(),
            inspectorId: "INSP-01",
        });
        license.applySanction(sanction2);
        expect(license.licenseStatus).toBe(LicenseStatusEnum.REVOKED);
        const sanction3 = new Sanction({
            id: "SANC-003",
            penalty: 4,
            licenseId: "LIC-001",
            reason: "Mancato uso DPI",
            issuedAt: new Date(),
            inspectorId: "INSP-01",
        });
        license.applySanction(sanction3);
        expect(license.licenseStatus).toBe(LicenseStatusEnum.REVOKED);
    });

    it("should only add sanctions to history via applySanction", () => {
        const license = new License("LIC-001");
        const sanction1 = new Sanction({
            id: "SANC-001",
            penalty: 5,
            licenseId: "LIC-001",
            reason: "Mancato uso DPI",
            issuedAt: new Date(),
            inspectorId: "INSP-01",
        });
        const sanction2 = new Sanction({
            id: "SANC-002",
            penalty: 3,
            licenseId: "LIC-001",
            reason: "Omessa formazione",
            issuedAt: new Date(),
            inspectorId: "INSP-02",
        });

        expect(license.sanctions).toHaveLength(0);

        license.applySanction(sanction1);
        expect(license.sanctions).toHaveLength(1);
        expect(license.sanctions).toEqual([sanction1]);

        license.applySanction(sanction2);
        expect(license.sanctions).toHaveLength(2);
        expect(license.sanctions).toEqual([sanction1, sanction2]);
    });

    describe("fromLedger", () => {
        it("should reconstruct an ACTIVE license from ledger data", () => {
            const license = License.fromLedger({
                id: "LIC-001",
                credits: 25,
                status: "ACTIVE",
            });

            expect(license).toBeInstanceOf(License);
            expect(license.id).toBe("LIC-001");
            expect(license.credits).toBe(25);
            expect(license.licenseStatus).toBe(LicenseStatusEnum.ACTIVE);
            expect(license.sanctions).toEqual([]);
        });

        it("should reconstruct a REVOKED license from ledger data", () => {
            const license = License.fromLedger({
                id: "LIC-002",
                credits: 10,
                status: "REVOKED",
            });

            expect(license).toBeInstanceOf(License);
            expect(license.id).toBe("LIC-002");
            expect(license.credits).toBe(10);
            expect(license.licenseStatus).toBe(LicenseStatusEnum.REVOKED);
        });

        it("should reject unknown license statuses", () => {
            expect(() =>
                License.fromLedger({
                    id: "LIC-003",
                    credits: 30,
                    status: "SUSPENDED",
                }),
            ).toThrow("Invalid license status: SUSPENDED");

            expect(() =>
                License.fromLedger({
                    id: "LIC-003",
                    credits: 30,
                    status: "unknown",
                }),
            ).toThrow("Invalid license status: unknown");
        });
    });
});
