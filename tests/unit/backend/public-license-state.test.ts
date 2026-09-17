import { PublicLicenseState } from "../../../backend/src/domain/public-license-state.js";

describe("PublicLicenseState Domain Model", () => {
    it("should instantiate a valid PublicLicenseState", () => {
        const state = new PublicLicenseState(
            "ref-opaque-001",
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            1,
        );

        expect(state.licenseRef).toBe("ref-opaque-001");
        expect(state.commitment).toBe(
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        );
        expect(state.version).toBe(1);
    });

    it("should accept valid version numbers greater than 1", () => {
        const state = new PublicLicenseState("ref-002", "commitment-hash", 5);

        expect(state.version).toBe(5);
    });

    it("should reject an empty or whitespace-only licenseRef", () => {
        expect(() => new PublicLicenseState("", "commitment-hash", 1)).toThrow(
            "License reference cannot be empty",
        );

        expect(
            () => new PublicLicenseState("   ", "commitment-hash", 1),
        ).toThrow("License reference cannot be empty");

        expect(
            () =>
                new PublicLicenseState(
                    null as unknown as string,
                    "commitment-hash",
                    1,
                ),
        ).toThrow("License reference cannot be empty");

        expect(
            () =>
                new PublicLicenseState(
                    undefined as unknown as string,
                    "commitment-hash",
                    1,
                ),
        ).toThrow("License reference cannot be empty");
    });

    it("should reject an empty or whitespace-only commitment", () => {
        expect(() => new PublicLicenseState("ref-001", "", 1)).toThrow(
            "Commitment cannot be empty",
        );

        expect(() => new PublicLicenseState("ref-001", "   ", 1)).toThrow(
            "Commitment cannot be empty",
        );

        expect(
            () =>
                new PublicLicenseState(
                    "ref-001",
                    null as unknown as string,
                    1,
                ),
        ).toThrow("Commitment cannot be empty");

        expect(
            () =>
                new PublicLicenseState(
                    "ref-001",
                    undefined as unknown as string,
                    1,
                ),
        ).toThrow("Commitment cannot be empty");
    });

    it("should reject invalid version numbers (<= 0, NaN, non-number)", () => {
        expect(() => new PublicLicenseState("ref-001", "commitment", 0)).toThrow(
            "Version must be an integer greater than or equal to 1",
        );

        expect(
            () => new PublicLicenseState("ref-001", "commitment", -1),
        ).toThrow("Version must be an integer greater than or equal to 1");

        expect(
            () => new PublicLicenseState("ref-001", "commitment", NaN),
        ).toThrow("Version must be an integer greater than or equal to 1");

        expect(
            () =>
                new PublicLicenseState(
                    "ref-001",
                    "commitment",
                    null as unknown as number,
                ),
        ).toThrow("Version must be an integer greater than or equal to 1");
    });

    it("should reject decimal version numbers", () => {
        expect(
            () => new PublicLicenseState("ref-001", "commitment", 1.5),
        ).toThrow("Version must be an integer greater than or equal to 1");

        expect(
            () => new PublicLicenseState("ref-001", "commitment", 2.0001),
        ).toThrow("Version must be an integer greater than or equal to 1");
    });

    it("should verify that the public model does not contain private license data", () => {
        const state = new PublicLicenseState("ref-opaque-001", "hash-abc", 1);

        // Private fields must not exist on the public model
        expect((state as unknown as Record<string, unknown>).licenseId).toBeUndefined();
        expect((state as unknown as Record<string, unknown>).credits).toBeUndefined();
        expect((state as unknown as Record<string, unknown>).status).toBeUndefined();
        expect((state as unknown as Record<string, unknown>).randomness).toBeUndefined();

        // Object should strictly expose only the public on-chain properties
        const keys = Object.keys(state).sort();
        expect(keys).toEqual(["commitment", "licenseRef", "version"]);
    });
});
