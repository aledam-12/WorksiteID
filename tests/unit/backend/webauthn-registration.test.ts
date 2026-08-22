import { jest } from "@jest/globals";
import type {
    PublicKeyCredentialCreationOptionsJSON,
    RegistrationResponseJSON,
    VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import { IdentityService } from "../../../backend/src/services/identity-service.js";
import { CredentialRepository } from "../../../backend/src/repositories/credential-repository.js";
import { ChallengeStore } from "../../../backend/src/repositories/challenge-store.js";
import { WebAuthnService, WebAuthnServiceImpl } from "../../../backend/src/services/webauthn-service.js";
import { WebAuthnCredentials, WebAuthnUserType } from "../../../backend/src/domain/webauthn-credentials.js";

jest.mock("@simplewebauthn/server", () => {
    const actual = jest.requireActual<typeof import("@simplewebauthn/server")>("@simplewebauthn/server");
    return {
        ...actual,
        generateRegistrationOptions: jest.fn(),
        verifyRegistrationResponse: jest.fn(),
    };
});

describe("WebAuthnService - Registration", () => {
    let identityService: jest.Mocked<IdentityService>;
    let credentialRepository: jest.Mocked<CredentialRepository>;
    let challengeStore: jest.Mocked<ChallengeStore>;
    let webAuthnService: WebAuthnService;

    const mockedGenerateRegistrationOptions = generateRegistrationOptions as jest.MockedFunction<typeof generateRegistrationOptions>;
    const mockedVerifyRegistrationResponse = verifyRegistrationResponse as jest.MockedFunction<typeof verifyRegistrationResponse>;

    const mockResponse: RegistrationResponseJSON = {
        id: "cred-id-123",
        rawId: "cred-id-123",
        response: {
            clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0=",
            attestationObject: "o2NmbXRkbm9uZQ==",
        },
        type: "public-key",
        clientExtensionResults: {},
    };

    beforeEach(() => {
        jest.clearAllMocks();

        identityService = {
            exists: jest.fn(),
            findById: jest.fn(),
            registerWorker: jest.fn(),
            getWorkerById: jest.fn(),
            registerInspector: jest.fn(),
            getInspectorById: jest.fn(),
        };

        credentialRepository = {
            register: jest.fn(),
            findByUserId: jest.fn(),
            findById: jest.fn(),
            existsById: jest.fn(),
        };

        challengeStore = {
            store: jest.fn(),
            get: jest.fn(),
            delete: jest.fn(),
        };

        webAuthnService = new WebAuthnServiceImpl(
            credentialRepository,
            identityService,
            challengeStore,
        );
    });

    describe("beginRegistration", () => {
        it("should reject registration for unknown user", async () => {
            identityService.exists.mockResolvedValue(false);
            credentialRepository.findByUserId.mockResolvedValue(null);

            await expect(
                webAuthnService.beginRegistration("WRK-001", WebAuthnUserType.WORKER),
            ).rejects.toThrow("User not found");

            expect(identityService.exists).toHaveBeenCalledWith("WRK-001", WebAuthnUserType.WORKER);
            expect(mockedGenerateRegistrationOptions).not.toHaveBeenCalled();
            expect(challengeStore.store).not.toHaveBeenCalled();
        });

        it("should reject registration when user already has a credential", async () => {
            identityService.exists.mockResolvedValue(true);
            credentialRepository.findByUserId.mockResolvedValue(
                new WebAuthnCredentials("cred-123", "WRK-001", WebAuthnUserType.WORKER, "pubkey-123", 0),
            );

            await expect(
                webAuthnService.beginRegistration("WRK-001", WebAuthnUserType.WORKER),
            ).rejects.toThrow("User already has a credential");

            expect(mockedGenerateRegistrationOptions).not.toHaveBeenCalled();
            expect(challengeStore.store).not.toHaveBeenCalled();
        });

        it("should generate registration options and store the challenge", async () => {
            identityService.exists.mockResolvedValue(true);
            credentialRepository.findByUserId.mockResolvedValue(null);

            const mockOptions: PublicKeyCredentialCreationOptionsJSON = {
                challenge: "mock-challenge-abc",
                rp: { name: "worksiteID", id: "localhost" },
                user: { id: "WRK-001", name: "WRK-001", displayName: "WRK-001" },
                pubKeyCredParams: [],
                timeout: 60000,
                attestation: "none",
            };
            mockedGenerateRegistrationOptions.mockResolvedValue(mockOptions);

            const result = await webAuthnService.beginRegistration("WRK-001", WebAuthnUserType.WORKER);

            expect(result).toEqual(mockOptions);
            expect(mockedGenerateRegistrationOptions).toHaveBeenCalledWith(
                expect.objectContaining({
                    userName: "WRK-001",
                    rpName: "worksiteID",
                    attestationType: "none",
                }),
            );
            expect(challengeStore.store).toHaveBeenCalledWith("WRK-001", "mock-challenge-abc");
        });
    });

    describe("completeRegistration", () => {
        it("should reject completion for unknown user", async () => {
            identityService.exists.mockResolvedValue(false);

            await expect(
                webAuthnService.completeRegistration("WRK-001", WebAuthnUserType.WORKER, mockResponse),
            ).rejects.toThrow("User not found");

            expect(identityService.exists).toHaveBeenCalledWith("WRK-001", WebAuthnUserType.WORKER);
            expect(mockedVerifyRegistrationResponse).not.toHaveBeenCalled();
        });

        it("should reject completion when user already has a credential", async () => {
            identityService.exists.mockResolvedValue(true);
            credentialRepository.findByUserId.mockResolvedValue(
                new WebAuthnCredentials("cred-123", "WRK-001", WebAuthnUserType.WORKER, "pubkey-123", 0),
            );

            await expect(
                webAuthnService.completeRegistration("WRK-001", WebAuthnUserType.WORKER, mockResponse),
            ).rejects.toThrow("User already has a credential");

            expect(challengeStore.get).not.toHaveBeenCalled();
            expect(mockedVerifyRegistrationResponse).not.toHaveBeenCalled();
        });

        it("should reject completion when challenge is not found or expired", async () => {
            identityService.exists.mockResolvedValue(true);
            credentialRepository.findByUserId.mockResolvedValue(null);
            challengeStore.get.mockResolvedValue(null);

            await expect(
                webAuthnService.completeRegistration("WRK-001", WebAuthnUserType.WORKER, mockResponse),
            ).rejects.toThrow("Challenge not found or expired");

            expect(challengeStore.get).toHaveBeenCalledWith("WRK-001");
            expect(mockedVerifyRegistrationResponse).not.toHaveBeenCalled();
        });

        it("should reject completion and delete challenge when verification fails", async () => {
            identityService.exists.mockResolvedValue(true);
            credentialRepository.findByUserId.mockResolvedValue(null);
            challengeStore.get.mockResolvedValue("expected-challenge-123");

            mockedVerifyRegistrationResponse.mockResolvedValue({
                verified: false,
            });

            await expect(
                webAuthnService.completeRegistration("WRK-001", WebAuthnUserType.WORKER, mockResponse),
            ).rejects.toThrow("Registration verification failed");

            expect(mockedVerifyRegistrationResponse).toHaveBeenCalledWith(
                expect.objectContaining({
                    response: mockResponse,
                    expectedChallenge: "expected-challenge-123",
                }),
            );
            expect(challengeStore.delete).toHaveBeenCalledWith("WRK-001");
            expect(credentialRepository.register).not.toHaveBeenCalled();
        });

        it("should successfully verify response, register new credential, and delete challenge", async () => {
            identityService.exists.mockResolvedValue(true);
            credentialRepository.findByUserId.mockResolvedValue(null);
            challengeStore.get.mockResolvedValue("expected-challenge-123");

            mockedVerifyRegistrationResponse.mockResolvedValue({
                verified: true,
                registrationInfo: {
                    fmt: "none",
                    aaguid: "00000000-0000-0000-0000-000000000000",
                    credential: {
                        id: "cred-id-123",
                        publicKey: new Uint8Array([1, 2, 3, 4]),
                        counter: 0,
                    },
                    credentialType: "public-key",
                    attestationObject: new Uint8Array([]),
                    userVerified: true,
                    credentialDeviceType: "singleDevice",
                    credentialBackedUp: false,
                    origin: "http://localhost:3000",
                },
            });

            await webAuthnService.completeRegistration("WRK-001", WebAuthnUserType.WORKER, mockResponse);
            expect(challengeStore.get).toHaveBeenCalledWith("WRK-001");
            expect(mockedVerifyRegistrationResponse).toHaveBeenCalledWith(
                expect.objectContaining({
                    response: mockResponse,
                    expectedChallenge: "expected-challenge-123",
                }),
            );

            expect(credentialRepository.register).toHaveBeenCalledTimes(1);
            const registeredCred = credentialRepository.register.mock.calls[0]![0];
            expect(registeredCred.id).toBe("cred-id-123");
            expect(registeredCred.userId).toBe("WRK-001");
            expect(registeredCred.userType).toBe(WebAuthnUserType.WORKER);
            expect(registeredCred.counter).toBe(0);
            expect(registeredCred.publicKey).toBeDefined();

            expect(challengeStore.delete).toHaveBeenCalledWith("WRK-001");
        });

        it("should reject completion when registration info is missing", async () => {
            identityService.exists.mockResolvedValue(true);
            credentialRepository.findByUserId.mockResolvedValue(null);
            challengeStore.get.mockResolvedValue("expected-challenge-123");

            mockedVerifyRegistrationResponse.mockResolvedValue({
                verified: true,
                registrationInfo: undefined,
            } as unknown as VerifiedRegistrationResponse);

            await expect(
                webAuthnService.completeRegistration(
                    "WRK-001",
                    WebAuthnUserType.WORKER,
                    mockResponse,
                ),
            ).rejects.toThrow("Registration verification failed");

            expect(credentialRepository.register).not.toHaveBeenCalled();
            expect(challengeStore.delete).toHaveBeenCalledWith("WRK-001");
        });
    });
});
