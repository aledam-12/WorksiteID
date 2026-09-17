import { SanctionOnChain } from "../../../backend/src/domain/sanction-on-chain.js";

describe("SanctionOnChain Domain Model", () => {
    const validDate = new Date("2026-09-17T12:00:00Z");

    it("should instantiate a valid SanctionOnChain with Date", () => {
        const sanction = new SanctionOnChain({
            id: "SANCT-001",
            licenseRef: "LIC-REF-123",
            sanctionCommitment: "a".repeat(64),
            issuedAt: validDate,
            inspectorRef: "INSP-REF-99",
            version: 2,
        });

        expect(sanction.id).toBe("SANCT-001");
        expect(sanction.licenseRef).toBe("LIC-REF-123");
        expect(sanction.sanctionCommitment).toBe("a".repeat(64));
        expect(sanction.issuedAt).toEqual(validDate);
        expect(sanction.inspectorRef).toBe("INSP-REF-99");
        expect(sanction.version).toBe(2);
    });

    it("should correctly parse ISO date string in issuedAt", () => {
        const sanction = new SanctionOnChain({
            id: "SANCT-002",
            licenseRef: "LIC-REF-456",
            sanctionCommitment: "b".repeat(64),
            issuedAt: "2026-09-17T14:30:00.000Z",
            inspectorRef: "INSP-REF-01",
            version: 1,
        });

        expect(sanction.issuedAt).toBeInstanceOf(Date);
        expect(sanction.issuedAt.toISOString()).toBe(
            "2026-09-17T14:30:00.000Z",
        );
    });

    it("should correctly instantiate via fromLedger factory", () => {
        const data = {
            id: "SANCT-003",
            licenseRef: "LIC-REF-789",
            sanctionCommitment: "c".repeat(64),
            issuedAt: "2026-09-17T15:00:00Z",
            inspectorRef: "INSP-REF-02",
            version: 3,
        };

        const sanction = SanctionOnChain.fromLedger(data);

        expect(sanction.id).toBe("SANCT-003");
        expect(sanction.licenseRef).toBe("LIC-REF-789");
        expect(sanction.version).toBe(3);
    });

    it("should trim string inputs", () => {
        const sanction = new SanctionOnChain({
            id: "  SANCT-001  ",
            licenseRef: "  LIC-REF-123  ",
            sanctionCommitment: `  ${"a".repeat(64)}  `,
            issuedAt: validDate,
            inspectorRef: "  INSP-REF-99  ",
            version: 2,
        });

        expect(sanction.id).toBe("SANCT-001");
        expect(sanction.licenseRef).toBe("LIC-REF-123");
        expect(sanction.sanctionCommitment).toBe("a".repeat(64));
        expect(sanction.inspectorRef).toBe("INSP-REF-99");
    });

    it("should reject non-object data", () => {
        expect(() => new SanctionOnChain(null as unknown as { id: string; licenseRef: string; sanctionCommitment: string; issuedAt: Date; inspectorRef: string; version: number })).toThrow(
            "Sanction on-chain data must be an object",
        );
    });

    it("should reject empty or whitespace id", () => {
        expect(
            () =>
                new SanctionOnChain({
                    id: "",
                    licenseRef: "LIC-REF-123",
                    sanctionCommitment: "a".repeat(64),
                    issuedAt: validDate,
                    inspectorRef: "INSP-REF-99",
                    version: 2,
                }),
        ).toThrow("Sanction ID cannot be empty");

        expect(
            () =>
                new SanctionOnChain({
                    id: "   ",
                    licenseRef: "LIC-REF-123",
                    sanctionCommitment: "a".repeat(64),
                    issuedAt: validDate,
                    inspectorRef: "INSP-REF-99",
                    version: 2,
                }),
        ).toThrow("Sanction ID cannot be empty");
    });

    it("should reject empty licenseRef", () => {
        expect(
            () =>
                new SanctionOnChain({
                    id: "SANCT-001",
                    licenseRef: "",
                    sanctionCommitment: "a".repeat(64),
                    issuedAt: validDate,
                    inspectorRef: "INSP-REF-99",
                    version: 2,
                }),
        ).toThrow("License reference cannot be empty");
    });

    it("should reject empty sanctionCommitment", () => {
        expect(
            () =>
                new SanctionOnChain({
                    id: "SANCT-001",
                    licenseRef: "LIC-REF-123",
                    sanctionCommitment: "",
                    issuedAt: validDate,
                    inspectorRef: "INSP-REF-99",
                    version: 2,
                }),
        ).toThrow("Sanction commitment cannot be empty");
    });

    it("should reject invalid issuedAt date", () => {
        expect(
            () =>
                new SanctionOnChain({
                    id: "SANCT-001",
                    licenseRef: "LIC-REF-123",
                    sanctionCommitment: "a".repeat(64),
                    issuedAt: "invalid-date",
                    inspectorRef: "INSP-REF-99",
                    version: 2,
                }),
        ).toThrow("IssuedAt must be a valid Date");

        expect(
            () =>
                new SanctionOnChain({
                    id: "SANCT-001",
                    licenseRef: "LIC-REF-123",
                    sanctionCommitment: "a".repeat(64),
                    issuedAt: null as unknown as Date,
                    inspectorRef: "INSP-REF-99",
                    version: 2,
                }),
        ).toThrow("IssuedAt must be a valid Date or ISO date string");
    });

    it("should reject empty inspectorRef", () => {
        expect(
            () =>
                new SanctionOnChain({
                    id: "SANCT-001",
                    licenseRef: "LIC-REF-123",
                    sanctionCommitment: "a".repeat(64),
                    issuedAt: validDate,
                    inspectorRef: "",
                    version: 2,
                }),
        ).toThrow("Inspector reference cannot be empty");
    });

    it("should reject invalid version (<= 0, NaN, non-integer)", () => {
        expect(
            () =>
                new SanctionOnChain({
                    id: "SANCT-001",
                    licenseRef: "LIC-REF-123",
                    sanctionCommitment: "a".repeat(64),
                    issuedAt: validDate,
                    inspectorRef: "INSP-REF-99",
                    version: 0,
                }),
        ).toThrow("Version must be an integer greater than or equal to 1");

        expect(
            () =>
                new SanctionOnChain({
                    id: "SANCT-001",
                    licenseRef: "LIC-REF-123",
                    sanctionCommitment: "a".repeat(64),
                    issuedAt: validDate,
                    inspectorRef: "INSP-REF-99",
                    version: -1,
                }),
        ).toThrow("Version must be an integer greater than or equal to 1");

        expect(
            () =>
                new SanctionOnChain({
                    id: "SANCT-001",
                    licenseRef: "LIC-REF-123",
                    sanctionCommitment: "a".repeat(64),
                    issuedAt: validDate,
                    inspectorRef: "INSP-REF-99",
                    version: 1.5,
                }),
        ).toThrow("Version must be an integer greater than or equal to 1");
    });

    it("should verify that on-chain sanction does not contain private data", () => {
        const sanction = new SanctionOnChain({
            id: "SANCT-001",
            licenseRef: "LIC-REF-123",
            sanctionCommitment: "a".repeat(64),
            issuedAt: validDate,
            inspectorRef: "INSP-REF-99",
            version: 2,
        });

        expect((sanction as unknown as Record<string, unknown>).penalty).toBeUndefined();
        expect((sanction as unknown as Record<string, unknown>).reason).toBeUndefined();
        expect((sanction as unknown as Record<string, unknown>).licenseId).toBeUndefined();
        expect((sanction as unknown as Record<string, unknown>).inspectorId).toBeUndefined();

        const keys = Object.keys(sanction).sort();
        expect(keys).toEqual([
            "id",
            "inspectorRef",
            "issuedAt",
            "licenseRef",
            "sanctionCommitment",
            "version",
        ]);
    });
});
