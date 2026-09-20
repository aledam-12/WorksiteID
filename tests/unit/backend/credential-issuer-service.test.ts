import crypto from "node:crypto";
import {
    CredentialIssuerServiceImpl,
} from "../../../backend/src/services/credential-issuer-service.js";
import {
    CredentialVerifierServiceImpl,
} from "../../../backend/src/services/credential-verifier-service.js";
import { InMemoryWorkerRepository } from "../../../backend/src/repositories/worker-repository.js";
import { Worker } from "../../../backend/src/domain/worker.js";
import {
    DEFAULT_CREDENTIAL_TYPE,
    DEFAULT_PROOF_PURPOSE,
    DEFAULT_PROOF_TYPE,
} from "../../../backend/src/domain/verifiable-credential.js";
import { InMemoryLicenseRepository } from "../../../backend/src/repositories/license-repository.js";
import { PrivateLicenseState } from "../../../backend/src/domain/private-license-state.js";
import { LicenseStatusEnum } from "../../../backend/src/domain/license.js";
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

        it("rifiuta l'inizializzazione se la public key non corrisponde alla private key", () => {
            const keyPair1 = crypto.generateKeyPairSync("ed25519");
            const keyPair2 = crypto.generateKeyPairSync("ed25519");

            const privatePem1 = keyPair1.privateKey.export({ type: "pkcs8", format: "pem" }) as string;
            const publicPem2 = keyPair2.publicKey.export({ type: "spki", format: "pem" }) as string;

            expect(() => {
                new CredentialIssuerServiceImpl(workerRepository, {
                    privateKeyPem: privatePem1,
                    publicKeyPem: publicPem2,
                });
            }).toThrow("Issuer public key does not match the private key");
        });

        it("garantisce la persistenza e verificabilità delle VC tra riavvii dell'issuer (chiavi da file PEM)", async () => {
            const fs = await import("node:fs");
            const path = await import("node:path");
            const os = await import("node:os");

            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vc-issuer-test-"));
            const privPath = path.join(tempDir, "test-priv.pem");
            const pubPath = path.join(tempDir, "test-pub.pem");

            try {
                const keyPair = crypto.generateKeyPairSync("ed25519");
                fs.writeFileSync(privPath, keyPair.privateKey.export({ type: "pkcs8", format: "pem" }));
                fs.writeFileSync(pubPath, keyPair.publicKey.export({ type: "spki", format: "pem" }));

                // 1. Prima istanza dell'issuer (prima del riavvio)
                const issuerBefore = new CredentialIssuerServiceImpl(workerRepository, {
                    issuerId: "worksiteid-issuer",
                    privateKeyPath: privPath,
                    publicKeyPath: pubPath,
                });

                const vc = await issuerBefore.issueLicenseCredential(WORKER_A_ID, LICENSE_A_REF);

                // 2. Seconda istanza dell'issuer (dopo il riavvio del backend, ricaricando le stesse chiavi)
                const issuerAfter = new CredentialIssuerServiceImpl(workerRepository, {
                    issuerId: "worksiteid-issuer",
                    privateKeyPath: privPath,
                    publicKeyPath: pubPath,
                });

                const verifier = new CredentialVerifierServiceImpl({
                    expectedIssuer: "worksiteid-issuer",
                    publicKeyPem: issuerAfter.getPublicKeyPem(),
                });

                // La VC emessa prima del riavvio deve essere verificata con successo con la chiave ricaricata
                const isValid = await verifier.verifyCredential(vc);
                expect(isValid).toBe(true);
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
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

        it("autorizza l'emissione verificando la titolarità tramite LicenseRepository.findByWorkerId()", async () => {
            const licenseRepo = new InMemoryLicenseRepository();
            const license = new PrivateLicenseState(
                "LIC-PRIV-001",
                30,
                LicenseStatusEnum.ACTIVE,
                "salt-001",
                1,
                WORKER_A_ID,
                "REF-FROM-LICENSE-REPO-001",
            );
            await licenseRepo.save(license);

            const serviceWithLicenseRepo = new CredentialIssuerServiceImpl(
                workerRepository,
                { issuerId: "worksiteid-issuer" },
                licenseRepo,
            );

            const cred = await serviceWithLicenseRepo.issueLicenseCredential(
                WORKER_A_ID,
                "REF-FROM-LICENSE-REPO-001",
            );
            expect(cred.credentialSubject.workerId).toBe(WORKER_A_ID);
            expect(cred.credentialSubject.licenseRef).toBe("REF-FROM-LICENSE-REPO-001");

            await expect(
                serviceWithLicenseRepo.issueLicenseCredential(
                    WORKER_A_ID,
                    "OTHER-LICENSE-REF",
                ),
            ).rejects.toThrow(`Worker ${WORKER_A_ID} is not authorized for license OTHER-LICENSE-REF`);
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
