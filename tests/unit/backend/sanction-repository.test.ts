import { Sanction } from "../../../backend/src/domain/sanction.js";
import {
    InMemorySanctionRepository,
    SanctionRepository,
} from "../../../backend/src/repositories/sanction-repository.js";

describe("SanctionRepository (InMemory)", () => {
    let repo: SanctionRepository;

    beforeEach(() => {
        repo = new InMemorySanctionRepository();
    });

    const makeSanction = (id: string, licenseRef: string, inspectorRef: string) =>
        new Sanction({
            id,
            penalty: 5,
            licenseRef,
            reason: "Mancato uso DPI",
            inspectorRef,
            issuedAt: new Date(),
            randomness: "random-salt-123",
        });

    it("should save and find sanction by id", async () => {
        const s = makeSanction("SANC-001", "ref-001", "INSP-01");
        await repo.save(s);

        const found = await repo.findById("SANC-001");
        expect(found).toEqual(s);
    });

    it("should reject duplicate sanction ID", async () => {
        const s1 = makeSanction("SANC-001", "ref-001", "INSP-01");
        const s2 = makeSanction("SANC-001", "ref-002", "INSP-02");

        await repo.save(s1);
        await expect(repo.save(s2)).rejects.toThrow("Sanction already exists");
    });

    it("should find sanctions by licenseRef and inspectorRef", async () => {
        const s1 = makeSanction("SANC-001", "ref-A", "INSP-01");
        const s2 = makeSanction("SANC-002", "ref-A", "INSP-02");
        const s3 = makeSanction("SANC-003", "ref-B", "INSP-01");

        await repo.save(s1);
        await repo.save(s2);
        await repo.save(s3);

        const byLicense = await repo.findByLicenseRef("ref-A");
        expect(byLicense).toHaveLength(2);

        const byInspector = await repo.findByInspectorRef("INSP-01");
        expect(byInspector).toHaveLength(2);
    });

    it("should delete a sanction", async () => {
        const s = makeSanction("SANC-001", "ref-001", "INSP-01");
        await repo.save(s);

        expect(await repo.delete("SANC-001")).toBe(true);
        expect(await repo.findById("SANC-001")).toBeNull();
        expect(await repo.delete("SANC-001")).toBe(false);
    });
});
