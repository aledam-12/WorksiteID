import { LicenseStatusEnum } from "../../../backend/src/domain/license.js";
import { PrivateLicenseState } from "../../../backend/src/domain/private-license-state.js";
import {
    InMemoryLicenseRepository,
    LicenseRepository,
} from "../../../backend/src/repositories/license-repository.js";

describe("LicenseRepository (InMemory)", () => {
    let repo: LicenseRepository;

    beforeEach(() => {
        repo = new InMemoryLicenseRepository();
    });

    const makeLicense = (
        licenseId: string,
        workerId: string,
        licenseRef: string,
        credits = 30,
        version = 1,
    ) =>
        new PrivateLicenseState(
            licenseId,
            credits,
            LicenseStatusEnum.ACTIVE,
            "1234567890abcdef",
            version,
            workerId,
            licenseRef,
        );

    it("should save and retrieve a license by licenseId, workerId, and licenseRef", async () => {
        const license = makeLicense("LIC-001", "WRK-001", "ref-001");
        await repo.save(license);

        const byId = await repo.findByLicenseId("LIC-001");
        expect(byId).toEqual(license);

        const byWorker = await repo.findByWorkerId("WRK-001");
        expect(byWorker).toEqual(license);

        const byRef = await repo.findByLicenseRef("ref-001");
        expect(byRef).toEqual(license);
    });

    it("should reject duplicate licenseId", async () => {
        const lic1 = makeLicense("LIC-001", "WRK-001", "ref-001");
        const lic2 = makeLicense("LIC-001", "WRK-002", "ref-002");

        await repo.save(lic1);
        await expect(repo.save(lic2)).rejects.toThrow("License already exists");
    });

    it("should reject duplicate workerId", async () => {
        const lic1 = makeLicense("LIC-001", "WRK-001", "ref-001");
        const lic2 = makeLicense("LIC-002", "WRK-001", "ref-002");

        await repo.save(lic1);
        await expect(repo.save(lic2)).rejects.toThrow("Worker already has a license");
    });

    it("should reject duplicate licenseRef", async () => {
        const lic1 = makeLicense("LIC-001", "WRK-001", "ref-001");
        const lic2 = makeLicense("LIC-002", "WRK-002", "ref-001");

        await repo.save(lic1);
        await expect(repo.save(lic2)).rejects.toThrow("License ref already exists");
    });

    it("should update a license", async () => {
        const lic = makeLicense("LIC-001", "WRK-001", "ref-001", 30, 1);
        await repo.save(lic);

        const updated = new PrivateLicenseState(
            "LIC-001",
            25,
            LicenseStatusEnum.ACTIVE,
            "fedcba0987654321",
            2,
            "WRK-001",
            "ref-001",
        );
        await repo.update(updated);

        const found = await repo.findByLicenseId("LIC-001");
        expect(found?.credits).toBe(25);
        expect(found?.version).toBe(2);
    });

    it("should support create, findById, and updateState aliases", async () => {
        const lic = makeLicense("LIC-ALIAS-1", "WRK-ALIAS-1", "ref-alias-1", 30, 1);
        await repo.create(lic);

        const found = await repo.findById("LIC-ALIAS-1");
        expect(found).toEqual(lic);

        const updated = new PrivateLicenseState(
            "LIC-ALIAS-1",
            20,
            LicenseStatusEnum.ACTIVE,
            "new-randomness",
            2,
            "WRK-ALIAS-1",
            "ref-alias-1",
        );
        await repo.updateState(updated);

        const foundUpdated = await repo.findById("LIC-ALIAS-1");
        expect(foundUpdated?.credits).toBe(20);
        expect(foundUpdated?.version).toBe(2);
    });

    it("should delete a license", async () => {
        const lic = makeLicense("LIC-001", "WRK-001", "ref-001");
        await repo.save(lic);

        expect(await repo.delete("LIC-001")).toBe(true);
        expect(await repo.findByLicenseId("LIC-001")).toBeNull();
        expect(await repo.delete("LIC-001")).toBe(false);
    });
});
