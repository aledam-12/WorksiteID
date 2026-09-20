describe("envConfig", () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();

        process.env = {
            ...originalEnv,
            NODE_ENV: "test",
            PORT: "3000",
            FIREFLY_API_URL: "http://localhost:5000",
            FIREFLY_NAMESPACE: "default",
            FIREFLY_ISSUER_ID: "worksiteid-issuer",
        };
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    it("should load a valid configuration", async () => {
        const { envConfig } = await import(
            "../../../backend/src/config/index.ts"
        );

        expect(envConfig).toEqual({
            nodeEnv: "test",
            port: 3000,
            fireflyUrl: "http://localhost:5000",
            fireflyNamespace: "default",
            fireflyIssuerId: "worksiteid-issuer",
            fireflyApiName: "sanction_contract",
            zkpWasmPath: expect.any(String),
            zkpZkeyPath: expect.any(String),
            zkpVerificationKeyPath: expect.any(String),
            issuerPrivateKeyPath: undefined,
            issuerPublicKeyPath: undefined,
            issuerPrivateKeyPem: undefined,
            issuerPublicKeyPem: undefined,
            dbHost: "localhost",
            dbPort: 3306,
            dbName: "worksiteid",
            dbUser: "root",
            dbPassword: "",
            licenseRefSecret: undefined,
            vcIssuerId: "worksiteid-issuer",
            rpId: "localhost",
            origin: "http://localhost:3000",
        });
    });

    it("should use default values for NODE_ENV and PORT", async () => {
        delete process.env.NODE_ENV;
        delete process.env.PORT;

        const { envConfig } = await import(
            "../../../backend/src/config/index.ts"
        );

        expect(envConfig.nodeEnv).toBe("development");
        expect(envConfig.port).toBe(3000);
    });

    it("should use development defaults when FIREFLY env vars are not set in development", async () => {
        delete process.env.FIREFLY_API_URL;
        delete process.env.FIREFLY_URL;
        delete process.env.FIREFLY_NAMESPACE;
        delete process.env.FIREFLY_API_NAME;
        process.env.NODE_ENV = "development";

        const { envConfig } = await import(
            "../../../backend/src/config/index.ts"
        );

        expect(envConfig.fireflyUrl).toBe("http://127.0.0.1:5001");
        expect(envConfig.fireflyNamespace).toBe("default");
        expect(envConfig.fireflyApiName).toBe("sanction_contract");
    });

    it("should prioritize FIREFLY_URL over FIREFLY_API_URL", async () => {
        process.env.FIREFLY_URL = "http://127.0.0.1:5001";
        process.env.FIREFLY_API_URL = "http://localhost:5000";

        const { envConfig } = await import(
            "../../../backend/src/config/index.ts"
        );

        expect(envConfig.fireflyUrl).toBe("http://127.0.0.1:5001");
    });

    it("should reject an invalid NODE_ENV", async () => {
        process.env.NODE_ENV = "invalid";

        await expect(
            import("../../../backend/src/config/index.ts"),
        ).rejects.toThrow("NODE_ENV must be one of");
    });

    it("should reject an invalid PORT", async () => {
        process.env.PORT = "abc";

        await expect(
            import("../../../backend/src/config/index.ts"),
        ).rejects.toThrow("PORT must be a valid integer port number");
    });

    it("should reject a PORT outside the valid range", async () => {
        process.env.PORT = "70000";

        await expect(
            import("../../../backend/src/config/index.ts"),
        ).rejects.toThrow("PORT must be a valid integer port number");
    });

    it("should reject an empty FIREFLY_API_URL", async () => {
        delete process.env.FIREFLY_URL;
        process.env.FIREFLY_API_URL = "";

        await expect(
            import("../../../backend/src/config/index.ts"),
        ).rejects.toThrow("FIREFLY_API_URL must not be empty");
    });

    it("should reject an empty FIREFLY_URL", async () => {
        process.env.FIREFLY_URL = "";

        await expect(
            import("../../../backend/src/config/index.ts"),
        ).rejects.toThrow("FIREFLY_URL must not be empty");
    });

    it("should reject an invalid FIREFLY_API_URL", async () => {
        delete process.env.FIREFLY_URL;
        process.env.FIREFLY_API_URL = "not-a-url";

        await expect(
            import("../../../backend/src/config/index.ts"),
        ).rejects.toThrow("FIREFLY_API_URL must be a valid URL");
    });

    it("should reject an invalid FIREFLY_URL", async () => {
        process.env.FIREFLY_URL = "not-a-url";

        await expect(
            import("../../../backend/src/config/index.ts"),
        ).rejects.toThrow("FIREFLY_URL must be a valid URL");
    });

    it("should reject an empty FIREFLY_NAMESPACE", async () => {
        process.env.FIREFLY_NAMESPACE = "";

        await expect(
            import("../../../backend/src/config/index.ts"),
        ).rejects.toThrow("FIREFLY_NAMESPACE must not be empty");
    });

    it("should reject an empty FIREFLY_ISSUER_ID", async () => {
        process.env.FIREFLY_ISSUER_ID = "";

        await expect(
            import("../../../backend/src/config/index.ts"),
        ).rejects.toThrow("FIREFLY_ISSUER_ID must not be empty");
    });

    it("should reject an empty FIREFLY_API_NAME", async () => {
        process.env.FIREFLY_API_NAME = "";

        await expect(
            import("../../../backend/src/config/index.ts"),
        ).rejects.toThrow("FIREFLY_API_NAME must not be empty");
    });

    it("should trim string configuration values", async () => {
        process.env.FIREFLY_API_URL = "  http://localhost:5000  ";
        process.env.FIREFLY_NAMESPACE = "  default  ";
        process.env.FIREFLY_ISSUER_ID = "  worksiteid-issuer  ";
        process.env.FIREFLY_API_NAME = "  sanction_contract  ";

        const { envConfig } = await import(
            "../../../backend/src/config/index.ts"
        );

        expect(envConfig.fireflyUrl).toBe("http://localhost:5000");
        expect(envConfig.fireflyNamespace).toBe("default");
        expect(envConfig.fireflyIssuerId).toBe("worksiteid-issuer");
        expect(envConfig.fireflyApiName).toBe("sanction_contract");
    });

    it("should load issuer key configuration when provided", async () => {
        process.env.ISSUER_PRIVATE_KEY_PATH = "keys/issuer-private.pem";
        process.env.ISSUER_PUBLIC_KEY_PATH = "keys/issuer-public.pem";
        process.env.ISSUER_PRIVATE_KEY_PEM = "-----BEGIN PRIVATE KEY-----\nMIIB...==\n-----END PRIVATE KEY-----";
        process.env.ISSUER_PUBLIC_KEY_PEM = "-----BEGIN PUBLIC KEY-----\nMCow...==\n-----END PUBLIC KEY-----";

        const { envConfig } = await import(
            "../../../backend/src/config/index.ts"
        );

        expect(envConfig.issuerPrivateKeyPath).toContain("keys/issuer-private.pem");
        expect(envConfig.issuerPublicKeyPath).toContain("keys/issuer-public.pem");
        expect(envConfig.issuerPrivateKeyPem).toBe(process.env.ISSUER_PRIVATE_KEY_PEM);
        expect(envConfig.issuerPublicKeyPem).toBe(process.env.ISSUER_PUBLIC_KEY_PEM);
    });

    it("should prioritize VC_ISSUER_* over generic ISSUER_* variables", async () => {
        process.env.VC_ISSUER_ID = "vc-custom-issuer";
        process.env.VC_ISSUER_PRIVATE_KEY_PATH = "secrets/vc-private.pem";
        process.env.VC_ISSUER_PUBLIC_KEY_PATH = "secrets/vc-public.pem";
        process.env.ISSUER_PRIVATE_KEY_PATH = "old/private.pem";
        process.env.ISSUER_PUBLIC_KEY_PATH = "old/public.pem";

        const { envConfig } = await import(
            "../../../backend/src/config/index.ts"
        );

        expect(envConfig.vcIssuerId).toBe("vc-custom-issuer");
        expect(envConfig.issuerPrivateKeyPath).toContain("secrets/vc-private.pem");
        expect(envConfig.issuerPublicKeyPath).toContain("secrets/vc-public.pem");
    });

    it("should load database configuration when provided", async () => {
        process.env.DB_HOST = "192.168.1.100";
        process.env.DB_PORT = "3307";
        process.env.DB_NAME = "worksiteid_custom";
        process.env.DB_USER = "app_user";
        process.env.DB_PASSWORD = "secret_password";
        process.env.LICENSE_REF_SECRET = "super_secret_hmac_key";

        const { envConfig } = await import(
            "../../../backend/src/config/index.ts"
        );

        expect(envConfig.dbHost).toBe("192.168.1.100");
        expect(envConfig.dbPort).toBe(3307);
        expect(envConfig.dbName).toBe("worksiteid_custom");
        expect(envConfig.dbUser).toBe("app_user");
        expect(envConfig.dbPassword).toBe("secret_password");
        expect(envConfig.licenseRefSecret).toBe("super_secret_hmac_key");
    });

    it("should reject an invalid DB_PORT", async () => {
        process.env.DB_PORT = "invalid_port";

        await expect(
            import("../../../backend/src/config/index.ts"),
        ).rejects.toThrow("DB_PORT must be a valid integer port number");
    });

    it("should reject missing LICENSE_REF_SECRET in production", async () => {
        process.env.NODE_ENV = "production";
        delete process.env.LICENSE_REF_SECRET;

        await expect(
            import("../../../backend/src/config/index.ts"),
        ).rejects.toThrow("LICENSE_REF_SECRET is required in production environment");
    });
});