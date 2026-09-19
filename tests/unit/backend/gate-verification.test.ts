import { LicenseVerificationServiceImpl } from "../../../backend/src/services/license-verification-service.js";
import { ChallengeServiceImpl } from "../../../backend/src/services/challenge-service.js";
import { ZkpServiceImpl } from "../../../backend/src/services/zkp-service.js";
import { BlockchainService } from "../../../backend/src/services/blockchain-service.js";
import { LicenseOnChain } from "../../../backend/src/domain/license-on-chain.js";
import { LicenseStatusEnum } from "../../../backend/src/domain/license.js";
import {
    Groth16Proof,
    LicenseVerificationPayload,
    LicenseZkpWitness,
    VerificationOutcome,
} from "../../../backend/src/domain/zkp.js";

describe("Gate Verification Flow (Integrazione Verifica al Varco)", () => {
    let challengeService: ChallengeServiceImpl;
    let zkpService: ZkpServiceImpl;
    let blockchainService: jest.Mocked<BlockchainService>;
    let gateService: LicenseVerificationServiceImpl;

    const WORKER_ID = "WRK-001";
    const LICENSE_REF = "LIC-001";
    const TEST_RANDOMNESS = "123456789";

    const workerWitness: LicenseZkpWitness = {
        credits: 30,
        status: LicenseStatusEnum.ACTIVE,
        version: 1,
        randomness: TEST_RANDOMNESS,
    };

    let onChainCommitment: string;

    beforeAll(async () => {
        zkpService = new ZkpServiceImpl();

        // Calcoliamo il commitment autoritativo memorizzato on-chain su Fabric
        onChainCommitment = await zkpService.computeCommitment(
            workerWitness.credits,
            workerWitness.status,
            workerWitness.version,
            workerWitness.randomness,
        );
    });

    beforeEach(() => {
        challengeService = new ChallengeServiceImpl();

        blockchainService = {
            createLicense: jest.fn(),
            getLicenseState: jest.fn().mockResolvedValue(
                new LicenseOnChain(LICENSE_REF, onChainCommitment, 1),
            ),
            issueSanction: jest.fn(),
            getSanction: jest.fn(),
        };

        // L'orchestratore del varco collega il servizio di challenge, il servizio ZKP reale e la blockchain
        gateService = new LicenseVerificationServiceImpl(
            blockchainService,
            zkpService,
            challengeService,
        );
    });

    it("1. Proof valida + commitment corrente + challenge valida → PASS", async () => {
        // Passo A: Il varco genera una sfida casuale per il lavoratore
        const challengeRecord = await challengeService.createChallenge(
            WORKER_ID,
            LICENSE_REF,
        );

        // Passo B: Il lavoratore genera la prova Groth16 usando il witness privato e la challenge
        const { proof, publicSignals } = await zkpService.generateProof(
            workerWitness,
            challengeRecord.challenge,
        );

        // Passo C: Il varco riceve il payload pubblico
        const payload: LicenseVerificationPayload = {
            workerId: WORKER_ID,
            licenseRef: LICENSE_REF,
            challengeId: challengeRecord.id,
            proof,
            publicSignals,
        };

        const result = await gateService.verifyLicenseAccess(payload, WORKER_ID);

        expect(result.outcome).toBe(VerificationOutcome.PASS);
        expect(result.reason).toBeUndefined();

        // Verifica che la challenge sia stata consumata (anti-replay)
        const storedChallenge = await challengeService.getChallenge(challengeRecord.id);
        expect(storedChallenge?.used).toBe(true);
    }, 15000);

    it("2. Proof non valida → NOT_PASS", async () => {
        const challengeRecord = await challengeService.createChallenge(
            WORKER_ID,
            LICENSE_REF,
        );

        const { proof, publicSignals } = await zkpService.generateProof(
            workerWitness,
            challengeRecord.challenge,
        );

        // Corrompiamo un parametro della prova crittografica
        const corruptedProof: Groth16Proof = {
            ...proof,
            pi_a: ["999999999999999999999999999", proof.pi_a[1], proof.pi_a[2]],
        };

        const payload: LicenseVerificationPayload = {
            workerId: WORKER_ID,
            licenseRef: LICENSE_REF,
            challengeId: challengeRecord.id,
            proof: corruptedProof,
            publicSignals,
        };

        const result = await gateService.verifyLicenseAccess(payload, WORKER_ID);

        expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
        expect(result.reason).toContain("Invalid Groth16 proof");

        // Se la prova fallisce, la challenge NON viene consumata
        const storedChallenge = await challengeService.getChallenge(challengeRecord.id);
        expect(storedChallenge?.used).toBe(false);
    }, 15000);

    it("3. Commitment non aggiornato (patente sanzionata on-chain) → NOT_PASS", async () => {
        const challengeRecord = await challengeService.createChallenge(
            WORKER_ID,
            LICENSE_REF,
        );

        const { proof, publicSignals } = await zkpService.generateProof(
            workerWitness,
            challengeRecord.challenge,
        );

        // Simuliamo che la blockchain abbia un commitment diverso (es. sanzione emessa da un ispettore)
        blockchainService.getLicenseState.mockResolvedValue(
            new LicenseOnChain(
                LICENSE_REF,
                "8888888888888888888888888888888888888888888888888888888888888888",
                2,
            ),
        );

        const payload: LicenseVerificationPayload = {
            workerId: WORKER_ID,
            licenseRef: LICENSE_REF,
            challengeId: challengeRecord.id,
            proof,
            publicSignals,
        };

        const result = await gateService.verifyLicenseAccess(payload, WORKER_ID);

        expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
        expect(result.reason).toContain("Commitment mismatch");
    }, 15000);

    it("4. Challenge già usata (tentativo di replay) → NOT_PASS", async () => {
        const challengeRecord = await challengeService.createChallenge(
            WORKER_ID,
            LICENSE_REF,
        );

        const { proof, publicSignals } = await zkpService.generateProof(
            workerWitness,
            challengeRecord.challenge,
        );

        const payload: LicenseVerificationPayload = {
            workerId: WORKER_ID,
            licenseRef: LICENSE_REF,
            challengeId: challengeRecord.id,
            proof,
            publicSignals,
        };

        // Primo accesso: successo
        const firstAttempt = await gateService.verifyLicenseAccess(payload, WORKER_ID);
        expect(firstAttempt.outcome).toBe(VerificationOutcome.PASS);

        // Secondo accesso con la stessa identica challenge: respinto (anti-replay)
        const replayAttempt = await gateService.verifyLicenseAccess(payload, WORKER_ID);
        expect(replayAttempt.outcome).toBe(VerificationOutcome.NOT_PASS);
        expect(replayAttempt.reason).toContain("already been used");
    }, 15000);

    it("5. Worker non associato alla patente (Worker B usa patente/challenge di Worker A) → NOT_PASS", async () => {
        const challengeRecord = await challengeService.createChallenge(
            WORKER_ID, // rilasciata per WRK-001
            LICENSE_REF,
        );

        const { proof, publicSignals } = await zkpService.generateProof(
            workerWitness,
            challengeRecord.challenge,
        );

        const payload: LicenseVerificationPayload = {
            workerId: "WRK-IMPOSTOR-002",
            licenseRef: LICENSE_REF,
            challengeId: challengeRecord.id,
            proof,
            publicSignals,
        };

        // Worker B autenticato tenta di usare la richiesta
        const result = await gateService.verifyLicenseAccess(
            payload,
            "WRK-IMPOSTOR-002",
        );

        expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
        expect(result.reason).toContain("does not belong to worker");
    }, 15000);

    it("6. Privacy: il varco non restituisce mai crediti, randomness o witness privato", async () => {
        const challengeRecord = await challengeService.createChallenge(
            WORKER_ID,
            LICENSE_REF,
        );

        const { proof, publicSignals } = await zkpService.generateProof(
            workerWitness,
            challengeRecord.challenge,
        );

        const payload: LicenseVerificationPayload = {
            workerId: WORKER_ID,
            licenseRef: LICENSE_REF,
            challengeId: challengeRecord.id,
            proof,
            publicSignals,
        };

        const result = await gateService.verifyLicenseAccess(payload, WORKER_ID);

        // Verifica della privacy by design (GDPR)
        expect(result.outcome).toBe(VerificationOutcome.PASS);
        expect(result).not.toHaveProperty("credits");
        expect(result).not.toHaveProperty("randomness");
        expect(result).not.toHaveProperty("witness");
        expect(result).not.toHaveProperty("sanction");
        expect(Object.keys(result)).toEqual(["outcome"]);
    }, 15000);

    it("7. L'identità deriva unicamente da authenticatedWorkerId: manipolare payload.workerId non permette l'impersonificazione", async () => {
        // La challenge viene emessa per il lavoratore legittimo WRK-001
        const challengeRecord = await challengeService.createChallenge(
            WORKER_ID,
            LICENSE_REF,
        );

        const { proof, publicSignals } = await zkpService.generateProof(
            workerWitness,
            challengeRecord.challenge,
        );

        // L'attaccante inserisce payload.workerId = WORKER_ID ("WRK-001"), ma si autentica con la sua sessione "WRK-ATTACKER-999"
        const spoofedPayload: LicenseVerificationPayload = {
            workerId: WORKER_ID,
            licenseRef: LICENSE_REF,
            challengeId: challengeRecord.id,
            proof,
            publicSignals,
        };

        // Il varco riceve la sessione autenticata dell'attaccante
        const result = await gateService.verifyLicenseAccess(
            spoofedPayload,
            "WRK-ATTACKER-999",
        );

        expect(result.outcome).toBe(VerificationOutcome.NOT_PASS);
        expect(result.reason).toContain("Challenge does not belong to worker: WRK-ATTACKER-999");
    }, 15000);
});
