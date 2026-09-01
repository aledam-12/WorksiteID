import { Wallet } from "../../../backend/src/domain/wallet.js";
import { WebAuthnUserType } from "../../../backend/src/domain/webauthn-credentials.js";

describe("Wallet Domain Model", () => {
    it("should instantiate a valid wallet", () => {
        const wallet = new Wallet("WRK-001", WebAuthnUserType.WORKER);

        expect(wallet.userId).toBe("WRK-001");
        expect(wallet.userType).toBe(WebAuthnUserType.WORKER);
    });

    it("should reject an empty or whitespace-only user ID", () => {
        expect(() => new Wallet("", WebAuthnUserType.WORKER)).toThrow("User ID cannot be empty");
        expect(() => new Wallet("   ", WebAuthnUserType.WORKER)).toThrow("User ID cannot be empty");
        expect(() => new Wallet(null as unknown as string, WebAuthnUserType.WORKER)).toThrow("User ID cannot be empty");
    });

    it("should reject an invalid or null user type", () => {
        expect(() => new Wallet("WRK-001", null as unknown as WebAuthnUserType)).toThrow("User type cannot be empty or invalid");
        expect(() => new Wallet("WRK-001", "INVALID" as unknown as WebAuthnUserType)).toThrow("User type cannot be empty or invalid");
    });
});