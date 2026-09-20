import { LicenseReferenceService } from "../../../backend/src/services/license-reference-service.js";

describe("LicenseReferenceService", () => {
    const secretA = "test-secret-key-alpha-1234567890";
    const secretB = "test-secret-key-beta-0987654321";
    const licenseId = "LIC-IT-2026-0099";

    it("should throw error if secret is empty or missing", () => {
        expect(() => new LicenseReferenceService("")).toThrow(
            "LICENSE_REF_SECRET is required and cannot be empty",
        );
        expect(() => new LicenseReferenceService("   ")).toThrow(
            "LICENSE_REF_SECRET is required and cannot be empty",
        );
    });

    describe("generateLicenseRef", () => {
        it("should deterministically generate lowercase hex licenseRef for same secret and licenseId", () => {
            const service1 = new LicenseReferenceService(secretA);
            const service2 = new LicenseReferenceService(secretA);

            const ref1 = service1.generateLicenseRef(licenseId);
            const ref2 = service2.generateLicenseRef(licenseId);

            expect(ref1).toBe(ref2);
            expect(ref1).toMatch(/^[0-9a-f]{64}$/);
        });

        it("should produce different licenseRef for different secrets", () => {
            const service1 = new LicenseReferenceService(secretA);
            const service2 = new LicenseReferenceService(secretB);

            const ref1 = service1.generateLicenseRef(licenseId);
            const ref2 = service2.generateLicenseRef(licenseId);

            expect(ref1).not.toBe(ref2);
        });

        it("should produce different licenseRef for different licenseIds", () => {
            const service = new LicenseReferenceService(secretA);

            const ref1 = service.generateLicenseRef("LIC-001");
            const ref2 = service.generateLicenseRef("LIC-002");

            expect(ref1).not.toBe(ref2);
        });

        it("should handle whitespace trimming on licenseId", () => {
            const service = new LicenseReferenceService(secretA);

            const ref1 = service.generateLicenseRef(licenseId);
            const ref2 = service.generateLicenseRef(`  ${licenseId}  `);

            expect(ref1).toBe(ref2);
        });

        it("should throw if licenseId is empty", () => {
            const service = new LicenseReferenceService(secretA);

            expect(() => service.generateLicenseRef("")).toThrow(
                "licenseId is required and cannot be empty",
            );
            expect(() => service.generateLicenseRef("   ")).toThrow(
                "licenseId is required and cannot be empty",
            );
        });
    });

    describe("verifyLicenseRef", () => {
        const service = new LicenseReferenceService(secretA);
        const validRef = service.generateLicenseRef(licenseId);

        it("should return true for correct licenseRef", () => {
            expect(service.verifyLicenseRef(licenseId, validRef)).toBe(true);
            // Case-insensitive hex matching
            expect(service.verifyLicenseRef(licenseId, validRef.toUpperCase())).toBe(true);
        });

        it("should return false for modified licenseRef", () => {
            const tampered = validRef.substring(0, 63) + (validRef[63] === "a" ? "b" : "a");
            expect(service.verifyLicenseRef(licenseId, tampered)).toBe(false);
        });

        it("should return false for different licenseId", () => {
            expect(service.verifyLicenseRef("LIC-DIFFERENT-001", validRef)).toBe(false);
        });

        it("should return false for different secret", () => {
            const otherService = new LicenseReferenceService(secretB);
            expect(otherService.verifyLicenseRef(licenseId, validRef)).toBe(false);
        });

        it("should return false for invalid format or invalid length", () => {
            expect(service.verifyLicenseRef(licenseId, "short-ref")).toBe(false);
            expect(service.verifyLicenseRef(licenseId, "")).toBe(false);
            expect(service.verifyLicenseRef(licenseId, "   ")).toBe(false);
            expect(service.verifyLicenseRef(licenseId, validRef + "extra")).toBe(false);
            expect(service.verifyLicenseRef("", validRef)).toBe(false);
        });
    });
});
