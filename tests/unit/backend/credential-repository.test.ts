import {
    CredentialRepository,
    InMemoryCredentialRepository,
} from "../../../backend/src/repositories/credential-repository.js";
import {
    WebAuthnCredentials,
    WebAuthnUserType,
} from "../../../backend/src/domain/webauthn-credentials.js";

describe("CredentialRepository", () => {
    let repository: CredentialRepository;

    const createCredential = (
        id = "cred-1",
        userId = "WRK-001",
        userType = WebAuthnUserType.WORKER,
        publicKey = "public-key-sample",
        counter = 0,
    ) => new WebAuthnCredentials(id, userId, userType, publicKey, counter);

    beforeEach(() => {
        repository = new InMemoryCredentialRepository();
    });

    describe("register", () => {
        it("should register a credential and retrieve it by id", async () => {
            const credential = createCredential("cred-1", "WRK-001");

            await repository.register(credential);

            const found = await repository.findById("cred-1");
            expect(found).toEqual(credential);
        });
    });

    describe("findById", () => {
        it("should return the credential when present", async () => {
            const credential = createCredential("cred-2", "WRK-002");
            await repository.register(credential);

            const found = await repository.findById("cred-2");
            expect(found).toEqual(credential);
        });

        it("should return null when the credential is not found", async () => {
            const found = await repository.findById("non-existent-id");
            expect(found).toBeNull();
        });
    });

    describe("findByUserId", () => {
        it("should return the credential for an existing user", async () => {
            const credential = createCredential("cred-3", "INSP-001", WebAuthnUserType.INSPECTOR);
            await repository.register(credential);

            const found = await repository.findByUserId("INSP-001");
            expect(found).toEqual(credential);
        });

        it("should return null when the user has no credential", async () => {
            const found = await repository.findByUserId("non-existent-user");
            expect(found).toBeNull();
        });
    });

    describe("existsById", () => {
        it("should return true when credential exists and false when absent", async () => {
            const credential = createCredential("cred-4", "WRK-004");
            await repository.register(credential);

            expect(await repository.existsById("cred-4")).toBe(true);
            expect(await repository.existsById("cred-non-existent")).toBe(false);
        });
    });

    describe("duplicate constraints", () => {
        it("should reject duplicate credential IDs with 'Credential already exists'", async () => {
            const firstCredential = createCredential("cred-dup-id", "WRK-001");
            const secondCredential = createCredential("cred-dup-id", "WRK-002");

            await repository.register(firstCredential);

            await expect(
                repository.register(secondCredential),
            ).rejects.toThrow("Credential already exists");
        });

        it("should reject duplicate userId with 'User already has a credential'", async () => {
            const firstCredential = createCredential("cred-1", "WRK-001");
            const secondCredential = createCredential("cred-2", "WRK-001");

            await repository.register(firstCredential);

            await expect(
                repository.register(secondCredential),
            ).rejects.toThrow("User already has a credential");
        });
    });

    describe("initialCredentials", () => {
        it("should initialize repository with pre-populated credentials", async () => {
            const cred1 = createCredential("cred-init-1", "WRK-001");
            const cred2 = createCredential(
                "cred-init-2",
                "INSP-001",
                WebAuthnUserType.INSPECTOR,
            );

            const prePopulatedRepo = new InMemoryCredentialRepository([
                cred1,
                cred2,
            ]);

            expect(await prePopulatedRepo.findById("cred-init-1")).toEqual(cred1);
            expect(await prePopulatedRepo.findById("cred-init-2")).toEqual(cred2);
            expect(await prePopulatedRepo.findByUserId("WRK-001")).toEqual(cred1);
            expect(await prePopulatedRepo.findByUserId("INSP-001")).toEqual(cred2);
            expect(await prePopulatedRepo.existsById("cred-init-1")).toBe(true);
            expect(await prePopulatedRepo.existsById("cred-init-2")).toBe(true);
        });
    });
});
