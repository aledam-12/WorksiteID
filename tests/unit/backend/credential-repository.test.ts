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
        it("should return the credentials array for an existing user", async () => {
            const credential = createCredential("cred-3", "INSP-001", WebAuthnUserType.INSPECTOR);
            await repository.register(credential);

            const found = await repository.findByUserId("INSP-001");
            expect(found).toEqual([credential]);
        });

        it("should return an empty array when the user has no credential", async () => {
            const found = await repository.findByUserId("non-existent-user");
            expect(found).toEqual([]);
        });

        it("should return multiple credentials when registered for the same user", async () => {
            const credA = createCredential("cred-multi-1", "WRK-MULTI", WebAuthnUserType.WORKER);
            const credB = createCredential("cred-multi-2", "WRK-MULTI", WebAuthnUserType.WORKER);
            await repository.register(credA);
            await repository.register(credB);

            const found = await repository.findByUserId("WRK-MULTI");
            expect(found).toHaveLength(2);
            expect(found).toContainEqual(credA);
            expect(found).toContainEqual(credB);
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

        it("should allow multiple credentials for the same userId with distinct credential IDs", async () => {
            const firstCredential = createCredential("cred-1", "WRK-001");
            const secondCredential = createCredential("cred-2", "WRK-001");

            await repository.register(firstCredential);
            await expect(
                repository.register(secondCredential),
            ).resolves.toBeUndefined();

            const userCreds = await repository.findByUserId("WRK-001");
            expect(userCreds).toHaveLength(2);
        });
    });

    describe("Byte-perfect base64url mapping", () => {
        it("should preserve exact binary bytes through base64url <-> Buffer round-trip", () => {
            const rawBytes = Buffer.from([0x00, 0x01, 0xfe, 0xff, 0x3a, 0x7c, 0x99, 0xaa, 0xbb, 0xcc]);
            const base64url = rawBytes.toString("base64url");
            const restoredBuf = Buffer.from(base64url, "base64url");

            expect(restoredBuf.equals(rawBytes)).toBe(true);
            expect(restoredBuf.toString("base64url")).toBe(base64url);
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
            expect(await prePopulatedRepo.findByUserId("WRK-001")).toEqual([cred1]);
            expect(await prePopulatedRepo.findByUserId("INSP-001")).toEqual([cred2]);
            expect(await prePopulatedRepo.existsById("cred-init-1")).toBe(true);
            expect(await prePopulatedRepo.existsById("cred-init-2")).toBe(true);
        });
    });
});
