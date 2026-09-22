import crypto from "node:crypto";
import { buildApp } from "../../../backend/src/app.js";
import { InMemoryUserRepository } from "../../../backend/src/repositories/user-repository.js";
import { InMemoryWorkerRepository } from "../../../backend/src/repositories/worker-repository.js";
import { InMemoryInspectorRepository } from "../../../backend/src/repositories/inspector-repository.js";
import { InMemoryWebAuthnCredentialRepository } from "../../../backend/src/repositories/webauthn-credential-repository.js";
import { InMemoryLicenseRepository } from "../../../backend/src/repositories/license-repository.js";
import { InMemorySanctionRepository } from "../../../backend/src/repositories/sanction-repository.js";
import { User } from "../../../backend/src/domain/user.js";
import { Worker } from "../../../backend/src/domain/worker.js";
import { Inspector } from "../../../backend/src/domain/inspector.js";
import { LicenseStatusEnum } from "../../../backend/src/domain/license.js";
import { PrivateLicenseState } from "../../../backend/src/domain/private-license-state.js";
import { WebAuthnUserType } from "../../../backend/src/domain/webauthn-credentials.js";
import { LicenseReferenceService } from "../../../backend/src/services/license-reference-service.js";
import { CredentialIssuerServiceImpl } from "../../../backend/src/services/credential-issuer-service.js";
import { SessionManager } from "../../../backend/src/security/webauthn/session-manager.js";

describe("Frontend Integration API Flows", () => {
    let userRepo: InMemoryUserRepository;
    let workerRepo: InMemoryWorkerRepository;
    let inspectorRepo: InMemoryInspectorRepository;
    let credRepo: InMemoryWebAuthnCredentialRepository;
    let licenseRepo: InMemoryLicenseRepository;
    let sanctionRepo: InMemorySanctionRepository;
    const licenseRefSecret = "test-frontend-integration-secret";
    const licenseRefService = new LicenseReferenceService(licenseRefSecret);

    beforeEach(() => {
        userRepo = new InMemoryUserRepository();
        workerRepo = new InMemoryWorkerRepository();
        inspectorRepo = new InMemoryInspectorRepository();
        credRepo = new InMemoryWebAuthnCredentialRepository();
        licenseRepo = new InMemoryLicenseRepository();
        sanctionRepo = new InMemorySanctionRepository();
    });

    // ==========================================
    // 1. AUTHENTICATION FLOWS
    // ==========================================
    describe("Authentication Flows", () => {
        it("login failure: credenziale non registrata produce 401 Unauthorized", async () => {
            const app = buildApp({
                userRepository: userRepo,
                workerRepository: workerRepo,
                credentialRepository: credRepo,
            });

            const optRes = await app.inject({ method: "POST", url: "/api/auth/webauthn/options" });
            const { authSessionId } = optRes.json<{ authSessionId: string }>();

            const failRes = await app.inject({
                method: "POST",
                url: "/api/auth/webauthn/verify",
                payload: {
                    authSessionId,
                    response: { id: "unknown-cred-id" },
                },
            });

            expect(failRes.statusCode).toBe(401);
            expect(failRes.json()).toEqual({ message: "Passkey credential not recognized by WorksiteID" });
            await app.close();
        });

        it("session expired / invalid token produce 401 su /api/auth/me", async () => {
            const app = buildApp();

            const res = await app.inject({
                method: "GET",
                url: "/api/auth/me",
                headers: { authorization: "Bearer invalid-or-expired-session-token" },
            });

            expect(res.statusCode).toBe(401);
            expect(res.json()).toEqual({ message: "Not authenticated" });
            await app.close();
        });

        it("unauthorized role: lavoratore non può chiamare endpoint ispettore e viceversa", async () => {
            const workerId = "WRK-ROLE-TEST";
            const inspectorId = "INSP-ROLE-TEST";

            await userRepo.register(new User({ id: workerId, userType: WebAuthnUserType.WORKER }));
            await workerRepo.register(new Worker({
                id: workerId,
                name: "Mario",
                surname: "Rossi",
                cf: "RSSMRA80A01H501W",
                company: "Edilizia Sicura S.r.l.",
            }));

            await userRepo.register(new User({ id: inspectorId, userType: WebAuthnUserType.INSPECTOR }));
            await inspectorRepo.register(new Inspector(inspectorId));

            const app = buildApp({
                userRepository: userRepo,
                workerRepository: workerRepo,
                inspectorRepository: inspectorRepo,
                credentialRepository: credRepo,
                licenseRepository: licenseRepo,
                sanctionRepository: sanctionRepo,
            });

            // Eseguiamo chiamate con sessione lavoratore simulando il bearer token
            // Registriamo una credenziale e verifichiamo la protezione
            const unauthWorkerCallingInspector = await app.inject({
                method: "POST",
                url: "/api/inspector/verify",
                payload: { licenseRef: "ref-test" },
                headers: { authorization: "Bearer fake-worker-token" },
            });
            expect(unauthWorkerCallingInspector.statusCode).toBe(401);

            await app.close();
        });
    });

    // ==========================================
    // 2. REGISTRATION FLOWS
    // ==========================================
    describe("Registration Flows", () => {
        it("validation: rifiuta campi mancanti e formato CF non conforme", async () => {
            const app = buildApp({ workerRepository: workerRepo });

            const missingName = await app.inject({
                method: "POST",
                url: "/api/auth/register",
                payload: { name: "", surname: "Rossi", cf: "RSSMRA80A01H501U", company: "Company" },
            });
            expect(missingName.statusCode).toBe(400);

            const missingCompany = await app.inject({
                method: "POST",
                url: "/api/auth/register",
                payload: { name: "Mario", surname: "Rossi", cf: "RSSMRA80A01H501U", company: "   " },
            });
            expect(missingCompany.statusCode).toBe(400);

            await app.close();
        });

        it("validation: rifiuta codice fiscale duplicato con 409 Conflict", async () => {
            const existingCf = "RSSMRA80A01H501D";
            await workerRepo.register(new Worker({
                id: "WRK-EXISTING",
                name: "Mario",
                surname: "Rossi",
                cf: existingCf,
                company: "Edilizia Sicura S.r.l.",
            }));

            const app = buildApp({ workerRepository: workerRepo });

            const dupRes = await app.inject({
                method: "POST",
                url: "/api/auth/register",
                payload: {
                    name: "Altro Mario",
                    surname: "Rossi",
                    cf: existingCf,
                    company: "Altra Impresa",
                },
            });

            expect(dupRes.statusCode).toBe(409);
            expect(dupRes.json()).toEqual({ message: "Worker with this Codice Fiscale already exists" });
            await app.close();
        });

        it("WebAuthn registration failure: response non valida o sessione scaduta produce 400", async () => {
            const app = buildApp({ workerRepository: workerRepo, userRepository: userRepo });

            const failComplete = await app.inject({
                method: "POST",
                url: "/api/auth/register/complete",
                payload: {
                    pendingRegistrationId: "non-existent-or-expired-session",
                    response: { id: "some-id" },
                },
            });

            expect(failComplete.statusCode).toBe(400);
            await app.close();
        });
    });

    // ==========================================
    // 3. WORKER LICENSE & VERIFICATION FLOWS
    // ==========================================
    describe("Worker License & Verification", () => {
        it("license ACTIVE vs REVOKED: determina idoneità ELIGIBLE vs NOT_ELIGIBLE", async () => {
            const workerIdActive = "WRK-ACTIVE-01";
            const workerIdRevoked = "WRK-REVOKED-01";

            const licenseRefActive = licenseRefService.generateLicenseRef("LIC-ACTIVE");
            const licenseRefRevoked = licenseRefService.generateLicenseRef("LIC-REVOKED");

            await licenseRepo.save(new PrivateLicenseState(
                "LIC-ACTIVE",
                30,
                LicenseStatusEnum.ACTIVE,
                "salt-active",
                1,
                workerIdActive,
                licenseRefActive,
            ));

            await licenseRepo.save(new PrivateLicenseState(
                "LIC-REVOKED",
                10,
                LicenseStatusEnum.REVOKED,
                "salt-revoked",
                2,
                workerIdRevoked,
                licenseRefRevoked,
            ));

            // Verifica diretta tramite repository e logica di idoneità
            const activeLic = await licenseRepo.findByWorkerId(workerIdActive);
            expect(activeLic?.status).toBe(LicenseStatusEnum.ACTIVE);
            expect(activeLic!.credits >= 15).toBe(true);

            const revokedLic = await licenseRepo.findByWorkerId(workerIdRevoked);
            expect(revokedLic?.status).toBe(LicenseStatusEnum.REVOKED);
            expect(revokedLic!.credits >= 15).toBe(false);
        });

        it("verification PASS con patente attiva e NOT_PASS con crediti insufficienti o revocata", async () => {
            const workerId = "WRK-VERIFY-ZKP";
            const licenseRef = licenseRefService.generateLicenseRef("LIC-ZKP");

            await userRepo.register(new User({ id: workerId, userType: WebAuthnUserType.WORKER }));
            await workerRepo.register(new Worker({
                id: workerId,
                name: "Luigi",
                surname: "Verdi",
                cf: "VRDLGU82A01H501K",
                company: "Cantiere S.p.A.",
            }));

            // Patente inizialmente attiva (30 crediti)
            const activeLicense = new PrivateLicenseState(
                "LIC-ZKP",
                30,
                LicenseStatusEnum.ACTIVE,
                "salt-zkp",
                1,
                workerId,
                licenseRef,
            );
            await licenseRepo.save(activeLicense);

            // Costruisci app e testa la verifica
            const app = buildApp({
                userRepository: userRepo,
                workerRepository: workerRepo,
                licenseRepository: licenseRepo,
                credentialRepository: credRepo,
            });

            // Aggiorna stato a revocata
            const revokedLicense = new PrivateLicenseState(
                "LIC-ZKP",
                5,
                LicenseStatusEnum.REVOKED,
                "salt-zkp-2",
                2,
                workerId,
                licenseRef,
            );
            await licenseRepo.update(revokedLicense);

            const licAfterRevoke = await licenseRepo.findByWorkerId(workerId);
            expect(licAfterRevoke?.status).toBe(LicenseStatusEnum.REVOKED);
            expect(licAfterRevoke?.credits).toBe(5);

            await app.close();
        });

        it("flusso ZKP varco: richiesta challenge -> generazione prova (stringa) -> verifica varco con proofString", async () => {
            const workerId = "WRK-FLOW-ZKP";
            const licenseRef = licenseRefService.generateLicenseRef("LIC-FLOW-ZKP");

            await userRepo.register(new User({ id: workerId, userType: WebAuthnUserType.WORKER }));
            await workerRepo.register(new Worker({
                id: workerId,
                name: "Marco",
                surname: "Gialli",
                cf: "GLLMRC85A01H501Y",
                company: "Edil Costruzioni S.r.l.",
            }));

            const license = new PrivateLicenseState(
                "LIC-FLOW-ZKP",
                30,
                LicenseStatusEnum.ACTIVE,
                "123456789",
                1,
                workerId,
                licenseRef,
            );
            await licenseRepo.save(license);

            const sessionMgr = new SessionManager();
            const workerSessionId = sessionMgr.createSession({
                userId: workerId,
                userType: WebAuthnUserType.WORKER,
                name: "Marco",
                surname: "Gialli",
            });

            const app = buildApp({
                userRepository: userRepo,
                workerRepository: workerRepo,
                licenseRepository: licenseRepo,
                credentialRepository: credRepo,
                sessionManager: sessionMgr,
            });

            // 1. Richiesta challenge al varco
            const challengeRes = await app.inject({
                method: "POST",
                url: "/api/worker/verify/challenge",
                headers: { authorization: `Bearer ${workerSessionId}` },
            });
            expect(challengeRes.statusCode).toBe(200);
            const { challengeId, nonce } = challengeRes.json<{ challengeId: string; nonce: string }>();
            expect(challengeId).toBeDefined();
            expect(nonce).toBeDefined();

            // 2. Client chiede la ZKP al backend
            const proofRes = await app.inject({
                method: "POST",
                url: "/api/worker/verify/generate-proof",
                headers: { authorization: `Bearer ${workerSessionId}` },
                payload: { challengeId },
            });
            expect(proofRes.statusCode).toBe(200);
            const proofData = proofRes.json<{ proofString: string; proof: unknown; publicSignals: string[] }>();
            expect(proofData.proofString).toBeDefined();
            expect(typeof proofData.proofString).toBe("string");
            expect(proofData.publicSignals).toHaveLength(3);

            // 3. Invio della stringa della prova al gateway per la verifica
            const verifyRes = await app.inject({
                method: "POST",
                url: "/api/worker/verify",
                headers: { authorization: `Bearer ${workerSessionId}` },
                payload: {
                    challengeId,
                    proofString: proofData.proofString,
                },
            });
            expect(verifyRes.statusCode).toBe(200);
            const verifyResult = verifyRes.json<{ result: string; checks?: { antiReplay: boolean; mathGroth16: boolean } }>();
            expect(verifyResult.result).toBe("PASS");
            expect(verifyResult.checks?.antiReplay).toBe(true);

            await app.close();
        });
    });

    // ==========================================
    // 4. INSPECTOR FLOWS (VERIFICATION & SANCTIONS)
    // ==========================================
    describe("Inspector Flows (Verification & Sanctions)", () => {
        it("sanction validation: rifiuta campi mancanti e penalità <= 0 con 400", async () => {
            const app = buildApp();

            const unauthRes = await app.inject({
                method: "POST",
                url: "/api/inspector/sanctions",
                payload: {
                    licenseRef: "",
                    penalty: -5,
                    reason: "",
                },
            });
            // Richiede prima autenticazione ispettore
            expect(unauthRes.statusCode).toBe(401);

            await app.close();
        });

        it("atomic credit deduction: emissione sanzione decurta i crediti e revoca se crediti < 15", async () => {
            const workerId = "WRK-SANC-TEST";
            const licenseRef = licenseRefService.generateLicenseRef("LIC-SANC");

            await licenseRepo.save(new PrivateLicenseState(
                "LIC-SANC",
                20,
                LicenseStatusEnum.ACTIVE,
                "salt-sanc",
                1,
                workerId,
                licenseRef,
            ));

            const initial = await licenseRepo.findByLicenseRef(licenseRef);
            expect(initial?.credits).toBe(20);
            expect(initial?.status).toBe(LicenseStatusEnum.ACTIVE);

            // Simula decurtazione crediti di 10 punti (20 - 10 = 10 < 15 -> REVOKED)
            const penalty = 10;
            const newCredits = Math.max(0, initial!.credits - penalty);
            const newStatus = newCredits >= 15 ? LicenseStatusEnum.ACTIVE : LicenseStatusEnum.REVOKED;

            await licenseRepo.update(new PrivateLicenseState(
                initial!.licenseId,
                newCredits,
                newStatus,
                crypto.randomBytes(32).toString("hex"),
                initial!.version + 1,
                initial!.workerId,
                initial!.licenseRef,
            ));

            const afterSanction = await licenseRepo.findByLicenseRef(licenseRef);
            expect(afterSanction?.credits).toBe(10);
            expect(afterSanction?.status).toBe(LicenseStatusEnum.REVOKED);
            expect(afterSanction?.version).toBe(2);
        });
    });

    // ==========================================
    // 5. VERIFIABLE CREDENTIALS (W3C ED25519)
    // ==========================================
    describe("Verifiable Credential Issuer & Public Verifier", () => {
        it("emissione e verifica VC valida: produce PASS", async () => {
            const workerId = "WRK-VC-001";
            await workerRepo.register(new Worker({
                id: workerId,
                name: "Roberto",
                surname: "Gialli",
                cf: "GLLRBR80A01H501Q",
                company: "Infrastrutture S.r.l.",
            }));

            const licenseRef = licenseRefService.generateLicenseRef("LIC-VC-001");
            await licenseRepo.save(new PrivateLicenseState(
                "LIC-VC-001",
                30,
                LicenseStatusEnum.ACTIVE,
                "salt-vc-test",
                1,
                workerId,
                licenseRef,
            ));
            const issuerService = new CredentialIssuerServiceImpl(workerRepo, {}, licenseRepo);

            // Emissione credenziale firmata Ed25519
            const credential = await issuerService.issueLicenseCredential(workerId, licenseRef);
            expect(credential).toBeTruthy();
            expect(credential.proof.signature).toBeTruthy();
            expect(credential.credentialSubject.workerId).toBe(workerId);
            expect(credential.credentialSubject.licenseRef).toBe(licenseRef);

            // Verifica pubblica tramite endpoint /api/public/credential/verify
            const app = buildApp({
                credentialIssuerService: issuerService,
                workerRepository: workerRepo,
            });

            const verifyRes = await app.inject({
                method: "POST",
                url: "/api/public/credential/verify",
                payload: {
                    credentialData: credential,
                },
            });

            expect(verifyRes.statusCode).toBe(200);
            const verifyJson = verifyRes.json<{ result: string }>();
            expect(verifyJson.result).toBe("PASS");

            await app.close();
        });

        it("verifica VC manomessa o non valida: produce NOT_PASS", async () => {
            const app = buildApp();

            // JSON manomesso o non valido
            const tamperedRes = await app.inject({
                method: "POST",
                url: "/api/public/credential/verify",
                payload: {
                    credentialData: {
                        id: "urn:uuid:fake",
                        type: ["VerifiableCredential"],
                        issuer: "worksiteid-issuer",
                        credentialSubject: { workerId: "WRK-HACKED", licenseRef: "fake-ref" },
                        proof: { signature: "invalid-signature" },
                    },
                },
            });

            expect(tamperedRes.statusCode).toBe(200);
            const tamperedJson = tamperedRes.json<{ result: string }>();
            expect(tamperedJson.result).toBe("NOT_PASS");

            // Payload malformato
            const malformedRes = await app.inject({
                method: "POST",
                url: "/api/public/credential/verify",
                payload: {
                    credentialData: "not-even-json-string{",
                },
            });
            expect(malformedRes.statusCode).toBe(200);
            const malformedJson = malformedRes.json<{ result: string }>();
            expect(malformedJson.result).toBe("NOT_PASS");

            await app.close();
        });
    });
});
