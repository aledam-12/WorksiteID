import { LicenseOnChain } from "../../../backend/src/domain/license-on-chain.js";

describe("LicenseOnChain Domain Model", () => {
    it("should instantiate a valid LicenseOnChain", () => {
        const licenseOnChain = new LicenseOnChain(
            "LIC-REF-001",
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            1,
        );

        expect(licenseOnChain.licenseRef).toBe("LIC-REF-001");
        expect(licenseOnChain.commitment).toBe(
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        );
        expect(licenseOnChain.version).toBe(1);
    });

    it("should correctly instantiate via fromLedger factory", () => {
        const data = {
            licenseRef: "LIC-REF-002",
            commitment: "abc123hash",
            version: 3,
        };

        const licenseOnChain = LicenseOnChain.fromLedger(data);

        expect(licenseOnChain.licenseRef).toBe("LIC-REF-002");
        expect(licenseOnChain.commitment).toBe("abc123hash");
        expect(licenseOnChain.version).toBe(3);
    });

    it("should trim string inputs", () => {
        const licenseOnChain = new LicenseOnChain(
            "  LIC-REF-001  ",
            "  abc123hash  ",
            1,
        );

        expect(licenseOnChain.licenseRef).toBe("LIC-REF-001");
        expect(licenseOnChain.commitment).toBe("abc123hash");
    });

    it("should reject invalid ledger data object in fromLedger", () => {
        expect(() =>
            LicenseOnChain.fromLedger(null as unknown as { licenseRef: string; commitment: string; version: number }),
        ).toThrow("Ledger data must be an object");
    });

    it("should reject an empty or whitespace-only licenseRef", () => {
        expect(() => new LicenseOnChain("", "commitment-hash", 1)).toThrow(
            "License reference cannot be empty",
        );

        expect(() => new LicenseOnChain("   ", "commitment-hash", 1)).toThrow(
            "License reference cannot be empty",
        );

        expect(
            () =>
                new LicenseOnChain(
                    null as unknown as string,
                    "commitment-hash",
                    1,
                ),
        ).toThrow("License reference cannot be empty");
    });

    it("should reject an empty or whitespace-only commitment", () => {
        expect(() => new LicenseOnChain("ref-001", "", 1)).toThrow(
            "Commitment cannot be empty",
        );

        expect(() => new LicenseOnChain("ref-001", "   ", 1)).toThrow(
            "Commitment cannot be empty",
        );

        expect(
            () =>
                new LicenseOnChain(
                    "ref-001",
                    null as unknown as string,
                    1,
                ),
        ).toThrow("Commitment cannot be empty");
    });

    it("should reject invalid version numbers (<= 0, NaN, non-integer)", () => {
        expect(() => new LicenseOnChain("ref-001", "commitment", 0)).toThrow(
            "Version must be an integer greater than or equal to 1",
        );

        expect(() => new LicenseOnChain("ref-001", "commitment", -1)).toThrow(
            "Version must be an integer greater than or equal to 1",
        );

        expect(() => new LicenseOnChain("ref-001", "commitment", NaN)).toThrow(
            "Version must be an integer greater than or equal to 1",
        );

        expect(() => new LicenseOnChain("ref-001", "commitment", 1.5)).toThrow(
            "Version must be an integer greater than or equal to 1",
        );
    });

    it("should verify that the on-chain model does not contain private license data", () => {
        const state = new LicenseOnChain("ref-opaque-001", "hash-abc", 1);

        expect((state as unknown as Record<string, unknown>).licenseId).toBeUndefined();
        expect((state as unknown as Record<string, unknown>).credits).toBeUndefined();
        expect((state as unknown as Record<string, unknown>).status).toBeUndefined();
        expect((state as unknown as Record<string, unknown>).randomness).toBeUndefined();

        const keys = Object.keys(state).sort();
        expect(keys).toEqual(["commitment", "licenseRef", "version"]);
    });
});
