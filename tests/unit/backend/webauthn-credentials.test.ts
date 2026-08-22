import {
    WebAuthnCredentials,
    WebAuthnUserType,
} from "../../../backend/src/domain/webauthn-credentials.js";

describe("WebAuthnCredentials Domain Model", () => {
    describe("Creation", () => {
        it("should create a valid WORKER credential", () => {
            const credential = new WebAuthnCredentials(
                "cred-123",
                "WRK-001",
                WebAuthnUserType.WORKER,
                "pubkey-base64-worker",
                0,
            );

            expect(credential.id).toBe("cred-123");
            expect(credential.userId).toBe("WRK-001");
            expect(credential.userType).toBe(WebAuthnUserType.WORKER);
            expect(credential.publicKey).toBe("pubkey-base64-worker");
            expect(credential.counter).toBe(0);
        });

        it("should create a valid INSPECTOR credential", () => {
            const credential = new WebAuthnCredentials(
                "cred-456",
                "INSP-001",
                WebAuthnUserType.INSPECTOR,
                "pubkey-base64-inspector",
                10,
            );

            expect(credential.id).toBe("cred-456");
            expect(credential.userId).toBe("INSP-001");
            expect(credential.userType).toBe(WebAuthnUserType.INSPECTOR);
            expect(credential.publicKey).toBe("pubkey-base64-inspector");
            expect(credential.counter).toBe(10);
        });

        it("should trim strings and expose properties correctly", () => {
            const credential = new WebAuthnCredentials(
                "  cred-789  ",
                "  WRK-002  ",
                WebAuthnUserType.WORKER,
                "  pubkey-trimmed  ",
                5,
            );

            expect(credential.id).toBe("cred-789");
            expect(credential.userId).toBe("WRK-002");
            expect(credential.userType).toBe(WebAuthnUserType.WORKER);
            expect(credential.publicKey).toBe("pubkey-trimmed");
            expect(credential.counter).toBe(5);
        });
    });

    describe("Domain Validation Rules", () => {
        it("should reject empty or whitespace-only id", () => {
            expect(
                () =>
                    new WebAuthnCredentials(
                        "",
                        "WRK-001",
                        WebAuthnUserType.WORKER,
                        "pubkey",
                        0,
                    ),
            ).toThrow("Credential ID must not be empty");

            expect(
                () =>
                    new WebAuthnCredentials(
                        "   ",
                        "WRK-001",
                        WebAuthnUserType.WORKER,
                        "pubkey",
                        0,
                    ),
            ).toThrow("Credential ID must not be empty");
        });

        it("should reject empty or whitespace-only userId", () => {
            expect(
                () =>
                    new WebAuthnCredentials(
                        "cred-123",
                        "",
                        WebAuthnUserType.WORKER,
                        "pubkey",
                        0,
                    ),
            ).toThrow("User ID must not be empty");

            expect(
                () =>
                    new WebAuthnCredentials(
                        "cred-123",
                        "   ",
                        WebAuthnUserType.WORKER,
                        "pubkey",
                        0,
                    ),
            ).toThrow("User ID must not be empty");
        });

        it("should reject missing or empty publicKey", () => {
            expect(
                () =>
                    new WebAuthnCredentials(
                        "cred-123",
                        "WRK-001",
                        WebAuthnUserType.WORKER,
                        "",
                        0,
                    ),
            ).toThrow("Public key must not be empty");

            expect(
                () =>
                    new WebAuthnCredentials(
                        "cred-123",
                        "WRK-001",
                        WebAuthnUserType.WORKER,
                        "   ",
                        0,
                    ),
            ).toThrow("Public key must not be empty");
        });

        it("should reject counter < 0 on creation", () => {
            expect(
                () =>
                    new WebAuthnCredentials(
                        "cred-123",
                        "WRK-001",
                        WebAuthnUserType.WORKER,
                        "pubkey",
                        -1,
                    ),
            ).toThrow("Counter must be greater than or equal to 0");
        });

        it("should reject invalid userType", () => {
            expect(
                () =>
                    new WebAuthnCredentials(
                        "cred-123",
                        "WRK-001",
                        "invalid_type" as WebAuthnUserType,
                        "pubkey",
                        0,
                    ),
            ).toThrow("Invalid user type");
        });
    });

    describe("Controlled Counter Update", () => {
        it("should update counter with a strictly greater value", () => {
            const credential = new WebAuthnCredentials(
                "cred-123",
                "WRK-001",
                WebAuthnUserType.WORKER,
                "pubkey",
                5,
            );

            credential.updateCounter(6);
            expect(credential.counter).toBe(6);

            credential.updateCounter(10);
            expect(credential.counter).toBe(10);
        });

        it("should reject counter update when new counter is less than or equal to current counter", () => {
            const credential = new WebAuthnCredentials(
                "cred-123",
                "WRK-001",
                WebAuthnUserType.WORKER,
                "pubkey",
                5,
            );

            expect(() => credential.updateCounter(5)).toThrow(
                "New counter must be greater than current counter",
            );

            expect(() => credential.updateCounter(4)).toThrow(
                "New counter must be greater than current counter",
            );

            expect(credential.counter).toBe(5);
        });

        it("should reject negative counter on update", () => {
            const credential = new WebAuthnCredentials(
                "cred-123",
                "WRK-001",
                WebAuthnUserType.WORKER,
                "pubkey",
                0,
            );

            expect(() => credential.updateCounter(-1)).toThrow(
                "Counter must be greater than or equal to 0",
            );
        });
    });
});
