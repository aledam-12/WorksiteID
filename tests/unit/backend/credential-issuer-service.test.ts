import crypto from "node:crypto";
import {
    CredentialIssuerServiceImpl,
} from "../../../backend/src/services/credential-issuer-service.js";
import { InMemoryWorkerRepository } from "../../../backend/src/repositories/worker-repository.js";
import { Worker } from "../../../backend/src/domain/worker.js";
import {
    DEFAULT_CREDENTIAL_TYPE,
    DEFAULT_PROOF_PURPOSE,
    DEFAULT_PROOF_TYPE,
} from "../../../backend/src/domain/verifiable-credential.js";
import { envConfig } from "../../../backend/src/config/index.js";

describe("CredentialIssuerService", () => {
    let workerRepository: InMemoryWorkerRepository;
    let issuerService: CredentialIssuerServiceImpl;

    const WORKER_A_ID = "WRK-001";
    const LICENSE_A_REF = "LIC-001";

    const WORKER_B_ID = "WRK-002";
    const LICENSE_B_REF = "LIC-002";

    beforeEach(async () => {
        workerRepository = new InMemoryWorkerRepository();

        const workerA = new Worker({
            id: WORKER_A_ID,
            name: "Mario",
            surname: "Rossi",
            cf: "RSSMRA80A01H501U",
            company: "Edilizia Rossi Srl",
            licenseId: LICENSE_A_REF,
        });

        const workerB = new Worker({
            id: WORKER_B_ID,
            name: "Luigi",
            surname: "Bianchi",
            cf: "BNCLGU85B02F205Z",
            company: "Costruzioni Bianchi Spa",
            licenseId: LICENSE_B_REF,
        });

        await workerRepository.register(workerA);
        await workerRepository.register(workerB);

        issuerService = new CredentialIssuerServiceImpl(workerRepository, {
            issuerId: "worksiteid-issuer",
        });
    });

    describe("Emissione valida", () => {
        it("emette una Verifiable Credential per un lavoratore autenticato titolare della licenza", async () => {
            const credential = await issuerService.issueLicenseCredential(
                WORKER_A_ID,
                LICENSE_A_REF,
            );

            expect(credential).toBeDefined();
            expect(credential.id).toMatch(/^urn:uuid:[0-9a-f-]+$/i);
            expect(credential.type).toEqual(DEFAULT_CREDENTIAL_TYPE);
            expect(credential.issuer).toBe("worksiteid-issuer");
            expect(credential.issuanceDate).toBeDefined();
            expect(new Date(credential.issuanceDate).toISOString()).toBe(
                credential.issuanceDate,
            );

            expect(credential.credentialSubject).toEqual({
                workerId: WORKER_A_ID,
                licenseRef: LICENSE_A_REF,
            });

            expect(credential.proof).toBeDefined();
            expect(credential.proof.type).toBe(DEFAULT_PROOF_TYPE);
            expect(credential.proof.proofPurpose).toBe(DEFAULT_PROOF_PURPOSE);
            expect(credential.proof.verificationMethod).toBe(
                "worksiteid-issuer#key-1",
            );
            expect(credential.proof.signature).toBeDefined();
            expect(credential.proof.signature.length).toBeGreaterThan(0);
        });

        it("permette di configurare chiavi PEM esplicite", async () => {
            const keyPair = crypto.generateKeyPairSync("ed25519");
            const privatePem = keyPair.privateKey.export({
                type: "pkcs8",
                format: "pem",
            }) as string;
            const publicPem = keyPair.publicKey.export({
                type: "spki",
                format: "pem",
            }) as string;

            const customIssuer = new CredentialIssuerServiceImpl(
                workerRepository,
                {
                    issuerId: "custom-issuer",
                    privateKeyPem: privatePem,
                    publicKeyPem: publicPem,
                },
            );

            expect(customIssuer.getIssuerId()).toBe("custom-issuer");
            expect(customIssuer.getPublicKeyPem()).toBe(publicPem);
            expect(customIssuer.getVerificationMethod()).toBe(
                "custom-issuer#key-1",
            );

            const credential = await customIssuer.issueLicenseCredential(
                WORKER_A_ID,
                LICENSE_A_REF,
            );
            expect(credential.issuer).toBe("custom-issuer");
            expect(credential.proof.verificationMethod).toBe(
                "custom-issuer#key-1",
            );
        });

        it("rifiuta l'inizializzazione se privateKeyPath punta a un file inesistente", () => {
            expect(() => {
                new CredentialIssuerServiceImpl(workerRepository, {
                    privateKeyPath: "non-existent-priv.pem",
                });
            }).toThrow("Issuer private key file not found: non-existent-priv.pem");
        });

        it("rifiuta l'inizializzazione in production se la chiave privata non è configurata", () => {
            const originalNodeEnv = envConfig.nodeEnv;
            try {
                (envConfig as { nodeEnv: string }).nodeEnv = "production";
                expect(() => {
                    new CredentialIssuerServiceImpl(workerRepository, {});
                }).toThrow(
                    "Issuer private key is required in production environment",
                );
            } finally {
                (envConfig as { nodeEnv: string }).nodeEnv = originalNodeEnv;
            }
        });
    });

    describe("Minimizzazione dei dati (Privacy by Design)", () => {
        it("non include crediti, sanzioni, randomness o stati privati nella VC", async () => {
            const credential = await issuerService.issueLicenseCredential(
                WORKER_A_ID,
                LICENSE_A_REF,
            );

            const credAny = credential as unknown as Record<string, unknown>;
            const subjectAny = credential.credentialSubject as unknown as Record<
                string,
                unknown
            >;

            expect(credAny.credits).toBeUndefined();
            expect(credAny.randomness).toBeUndefined();
            expect(credAny.commitment).toBeUndefined();
            expect(credAny.sanctions).toBeUndefined();
            expect(credAny.status).toBeUndefined();

            expect(subjectAny.credits).toBeUndefined();
            expect(subjectAny.randomness).toBeUndefined();
            expect(subjectAny.commitment).toBeUndefined();
            expect(subjectAny.sanctions).toBeUndefined();
            expect(subjectAny.status).toBeUndefined();
        });
    });

    describe("Controlli di autorizzazione e sicurezza", () => {
        it("rifiuta l'emissione se Worker A tenta di ottenere la credenziale per la licenseRef di Worker B", async () => {
            await expect(
                issuerService.issueLicenseCredential(WORKER_A_ID, LICENSE_B_REF),
            ).rejects.toThrow(
                `Worker ${WORKER_A_ID} is not authorized for license ${LICENSE_B_REF}`,
            );
        });

        it("rifiuta l'emissione se authenticatedWorkerId è assente o vuoto", async () => {
            await expect(
                issuerService.issueLicenseCredential("", LICENSE_A_REF),
            ).rejects.toThrow("Authenticated worker ID is required");

            await expect(
                issuerService.issueLicenseCredential("   ", LICENSE_A_REF),
            ).rejects.toThrow("Authenticated worker ID is required");

            await expect(
                issuerService.issueLicenseCredential(
                    null as unknown as string,
                    LICENSE_A_REF,
                ),
            ).rejects.toThrow("Authenticated worker ID is required");
        });

        it("rifiuta l'emissione se licenseRef è assente o vuoto", async () => {
            await expect(
                issuerService.issueLicenseCredential(WORKER_A_ID, ""),
            ).rejects.toThrow("License reference is required");

            await expect(
                issuerService.issueLicenseCredential(WORKER_A_ID, "   "),
            ).rejects.toThrow("License reference is required");

            await expect(
                issuerService.issueLicenseCredential(
                    WORKER_A_ID,
                    null as unknown as string,
                ),
            ).rejects.toThrow("License reference is required");
        });

        it("rifiuta l'emissione se il lavoratore non esiste nel repository", async () => {
            await expect(
                issuerService.issueLicenseCredential(
                    "WRK-NON-ESISTENTE",
                    LICENSE_A_REF,
                ),
            ).rejects.toThrow("Worker not found: WRK-NON-ESISTENTE");
        });
    });
});
