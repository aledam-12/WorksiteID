import crypto from "node:crypto";
import {
    CredentialIssuerServiceImpl,
} from "../../../backend/src/services/credential-issuer-service.js";
import {
    CredentialVerifierServiceImpl,
} from "../../../backend/src/services/credential-verifier-service.js";
import { InMemoryWorkerRepository } from "../../../backend/src/repositories/worker-repository.js";
import { Worker } from "../../../backend/src/domain/worker.js";
import { WorksiteLicenseCredential } from "../../../backend/src/domain/verifiable-credential.js";

describe("CredentialVerifierService", () => {
    let workerRepository: InMemoryWorkerRepository;
    let issuerService: CredentialIssuerServiceImpl;
    let verifierService: CredentialVerifierServiceImpl;
    let validCredential: WorksiteLicenseCredential;

    const WORKER_ID = "WRK-001";
    const LICENSE_REF = "LIC-001";

    beforeEach(async () => {
        workerRepository = new InMemoryWorkerRepository();
        const worker = new Worker({
            id: WORKER_ID,
            name: "Mario",
            surname: "Rossi",
            cf: "RSSMRA80A01H501U",
            company: "Edilizia Rossi Srl",
            licenseId: LICENSE_REF,
        });
        await workerRepository.register(worker);

        issuerService = new CredentialIssuerServiceImpl(workerRepository, {
            issuerId: "worksiteid-issuer",
        });

        verifierService = new CredentialVerifierServiceImpl({
            expectedIssuer: "worksiteid-issuer",
            publicKeyPem: issuerService.getPublicKeyPem(),
        });

        validCredential = await issuerService.issueLicenseCredential(
            WORKER_ID,
            LICENSE_REF,
        );
    });

    describe("Verifica di credenziali valide", () => {
        it("restituisce true per una credenziale autentica e integra emessa dall'Issuer", async () => {
            const isValid = await verifierService.verifyCredential(validCredential);
            expect(isValid).toBe(true);
        });

        it("funziona anche passando un KeyObject publicKey direttamente", async () => {
            const pubKey = crypto.createPublicKey(issuerService.getPublicKeyPem());
            const customVerifier = new CredentialVerifierServiceImpl({
                expectedIssuer: "worksiteid-issuer",
                publicKey: pubKey,
            });

            const isValid = await customVerifier.verifyCredential(validCredential);
            expect(isValid).toBe(true);
        });
    });

    describe("Rilevazione di manomissione (Tampering)", () => {
        it("rifiuta la credenziale se workerId viene modificato", async () => {
            const tampered: WorksiteLicenseCredential = {
                ...validCredential,
                credentialSubject: {
                    ...validCredential.credentialSubject,
                    workerId: "WRK-ATTACKER",
                },
            };

            const isValid = await verifierService.verifyCredential(tampered);
            expect(isValid).toBe(false);
        });

        it("rifiuta la credenziale se licenseRef viene modificata", async () => {
            const tampered: WorksiteLicenseCredential = {
                ...validCredential,
                credentialSubject: {
                    ...validCredential.credentialSubject,
                    licenseRef: "LIC-FORGED-999",
                },
            };

            const isValid = await verifierService.verifyCredential(tampered);
            expect(isValid).toBe(false);
        });

        it("rifiuta la credenziale se issuer viene modificato", async () => {
            const tampered: WorksiteLicenseCredential = {
                ...validCredential,
                issuer: "fake-issuer",
            };

            const isValid = await verifierService.verifyCredential(tampered);
            expect(isValid).toBe(false);
        });

        it("rifiuta la credenziale se issuanceDate viene modificata", async () => {
            const tampered: WorksiteLicenseCredential = {
                ...validCredential,
                issuanceDate: "2020-01-01T00:00:00.000Z",
            };

            const isValid = await verifierService.verifyCredential(tampered);
            expect(isValid).toBe(false);
        });

        it("rifiuta la credenziale se la firma viene alterata", async () => {
            const tampered: WorksiteLicenseCredential = {
                ...validCredential,
                proof: {
                    ...validCredential.proof,
                    signature: "ZmFrZS1zaWduYXR1cmUtZGF0YQ==",
                },
            };

            const isValid = await verifierService.verifyCredential(tampered);
            expect(isValid).toBe(false);
        });

        it("rifiuta la credenziale se proof.created viene modificato", async () => {
            const tampered: WorksiteLicenseCredential = {
                ...validCredential,
                proof: {
                    ...validCredential.proof,
                    created: "2020-01-01T00:00:00.000Z",
                },
            };

            const isValid = await verifierService.verifyCredential(tampered);
            expect(isValid).toBe(false);
        });

        it("rifiuta la credenziale se id viene modificato", async () => {
            const tampered: WorksiteLicenseCredential = {
                ...validCredential,
                id: "urn:uuid:00000000-0000-0000-0000-000000000000",
            };

            const isValid = await verifierService.verifyCredential(tampered);
            expect(isValid).toBe(false);
        });

        it("rifiuta la credenziale se type viene alterato", async () => {
            const tampered: WorksiteLicenseCredential = {
                ...validCredential,
                type: ["VerifiableCredential"],
            };

            const isValid = await verifierService.verifyCredential(tampered);
            expect(isValid).toBe(false);
        });
    });

    describe("Validazione del verificationMethod configurato", () => {
        it("rifiuta la credenziale se verificationMethod non corrisponde a quello atteso", async () => {
            const tampered: WorksiteLicenseCredential = {
                ...validCredential,
                proof: {
                    ...validCredential.proof,
                    verificationMethod: "attacker-issuer#key-9",
                },
            };

            const isValid = await verifierService.verifyCredential(tampered);
            expect(isValid).toBe(false);
        });
    });

    describe("Isolamento crittografico delle chiavi", () => {
        it("rifiuta una credenziale firmata da un'altra coppia di chiavi (altro Issuer)", async () => {
            const otherIssuer = new CredentialIssuerServiceImpl(workerRepository, {
                issuerId: "worksiteid-issuer",
            });

            const otherCredential = await otherIssuer.issueLicenseCredential(
                WORKER_ID,
                LICENSE_REF,
            );

            // Il verifier configurato con la chiave di issuerService deve rifiutare otherCredential
            const isValid = await verifierService.verifyCredential(otherCredential);
            expect(isValid).toBe(false);
        });
    });

    describe("Robustezza su input malformato", () => {
        it("rifiuta credenziali nulle, undefined o non-oggetti", async () => {
            expect(
                await verifierService.verifyCredential(
                    null as unknown as WorksiteLicenseCredential,
                ),
            ).toBe(false);

            expect(
                await verifierService.verifyCredential(
                    undefined as unknown as WorksiteLicenseCredential,
                ),
            ).toBe(false);

            expect(
                await verifierService.verifyCredential(
                    "not-an-object" as unknown as WorksiteLicenseCredential,
                ),
            ).toBe(false);
        });

        it("rifiuta credenziali con campi vuoti o mancanti", async () => {
            const missingSubject = {
                ...validCredential,
                credentialSubject: undefined,
            } as unknown as WorksiteLicenseCredential;
            expect(await verifierService.verifyCredential(missingSubject)).toBe(false);

            const missingProof = {
                ...validCredential,
                proof: undefined,
            } as unknown as WorksiteLicenseCredential;
            expect(await verifierService.verifyCredential(missingProof)).toBe(false);

            const invalidDate = {
                ...validCredential,
                issuanceDate: "not-a-date",
            };
            expect(await verifierService.verifyCredential(invalidDate)).toBe(false);
        });

        it("richiede obbligatoriamente una chiave pubblica in fase di inizializzazione", () => {
            expect(() => {
                new CredentialVerifierServiceImpl({});
            }).toThrow(
                "CredentialVerifier requires a public key (publicKey, publicKeyPem, or publicKeyPath)",
            );
        });

        it("rifiuta se publicKeyPath punta a un file inesistente", () => {
            expect(() => {
                new CredentialVerifierServiceImpl({
                    publicKeyPath: "non-existent-key.pem",
                });
            }).toThrow("Issuer public key file not found: non-existent-key.pem");
        });
    });
});
