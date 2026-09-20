import { User } from "../../../backend/src/domain/user.js";
import { WebAuthnUserType } from "../../../backend/src/domain/webauthn-credentials.js";
import {
    InMemoryUserRepository,
    UserRepository,
} from "../../../backend/src/repositories/user-repository.js";

describe("UserRepository (InMemory)", () => {
    let repo: UserRepository;

    beforeEach(() => {
        repo = new InMemoryUserRepository();
    });

    it("should register and retrieve a user", async () => {
        const user = new User({
            id: "user-1",
            userType: WebAuthnUserType.WORKER,
        });

        await repo.register(user);

        const found = await repo.findById("user-1");
        expect(found).not.toBeNull();
        expect(found?.id).toBe("user-1");
        expect(found?.userType).toBe(WebAuthnUserType.WORKER);
    });

    it("should reject duplicate user ID", async () => {
        const user1 = new User({
            id: "user-1",
            userType: WebAuthnUserType.WORKER,
        });
        const user2 = new User({
            id: "user-1",
            userType: WebAuthnUserType.INSPECTOR,
        });

        await repo.register(user1);
        await expect(repo.register(user2)).rejects.toThrow("User already exists");
    });

    it("should check existsById correctly", async () => {
        expect(await repo.existsById("user-x")).toBe(false);

        await repo.register(
            new User({ id: "user-x", userType: WebAuthnUserType.INSPECTOR }),
        );
        expect(await repo.existsById("user-x")).toBe(true);
    });

    it("should delete a user", async () => {
        const user = new User({ id: "user-del", userType: WebAuthnUserType.WORKER });
        await repo.register(user);
        expect(await repo.delete("user-del")).toBe(true);
        expect(await repo.findById("user-del")).toBeNull();
        expect(await repo.delete("user-del")).toBe(false);
    });
});
