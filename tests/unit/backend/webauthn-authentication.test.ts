import { jest } from "@jest/globals";
import type {
    AuthenticationResponseJSON,
    PublicKeyCredentialRequestOptionsJSON,
    VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import { generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { IdentityService } from "../../../backend/src/services/identity-service.js";
import { CredentialRepository } from "../../../backend/src/repositories/credential-repository.js";
import { ChallengeStore } from "../../../backend/src/repositories/challenge-store.js";
import { WebAuthnService, WebAuthnServiceImpl } from "../../../backend/src/services/webauthn-service.js";
import { WebAuthnCredentials, WebAuthnUserType } from "../../../backend/src/domain/webauthn-credentials.js";

jest.mock("@simplewebauthn/server", () => {
    const actual = jest.requireActual<typeof import("@simplewebauthn/server")>("@simplewebauthn/server");
    return {
        ...actual,
        generateAuthenticationOptions: jest.fn(),
        verifyAuthenticationResponse: jest.fn(),
    };
});

describe("WebAuthnService - Authentication", () => {
    let identityService: jest.Mocked<IdentityService>;
    let credentialRepository: jest.Mocked<CredentialRepository>;
    let challengeStore: jest.Mocked<ChallengeStore>;
    let webAuthnService: WebAuthnService;

    const mockedGenerateAuthenticationOptions = generateAuthenticationOptions as jest.MockedFunction<typeof generateAuthenticationOptions>;
    const mockedVerifyAuthenticationResponse = verifyAuthenticationResponse as jest.MockedFunction<typeof verifyAuthenticationResponse>;

    const mockResponse: AuthenticationResponseJSON = {
        id: "cred-id-123",
        rawId: "cred-id-123",
        response: {
            clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0In0=",
            authenticatorData: "authenticator-data-base64url",
            signature: "signature-base64url",
            userHandle: "user-handle-base64url",
        },
        type: "public-key",
        clientExtensionResults: {},
    };

    const mockExistingCredential = new WebAuthnCredentials(
        "cred-id-123",
        "WRK-001",
        WebAuthnUserType.WORKER,
        "cHVibGljLWtleS1leGFtcGxl",
        5,
    );

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

    describe("beginAuthentication", () => {
        it("should reject authentication for unknown user in identity service", async () => {
            identityService.exists.mockResolvedValue(false);

            await expect(
                webAuthnService.beginAuthentication("WRK-001", WebAuthnUserType.WORKER),
            ).rejects.toThrow("User not found");

            expect(identityService.exists).toHaveBeenCalledWith("WRK-001", WebAuthnUserType.WORKER);
            expect(mockedGenerateAuthenticationOptions).not.toHaveBeenCalled();
            expect(challengeStore.store).not.toHaveBeenCalled();
        });

        it("should reject authentication when user has no stored credential", async () => {
            identityService.exists.mockResolvedValue(true);
            credentialRepository.findByUserId.mockResolvedValue(null);

            await expect(
                webAuthnService.beginAuthentication("WRK-001", WebAuthnUserType.WORKER),
            ).rejects.toThrow("User has no registered credential");

            expect(mockedGenerateAuthenticationOptions).not.toHaveBeenCalled();
            expect(challengeStore.store).not.toHaveBeenCalled();
        });

        it("should generate authentication options with allowed credential and store challenge", async () => {
            identityService.exists.mockResolvedValue(true);
            credentialRepository.findByUserId.mockResolvedValue(mockExistingCredential);

            const mockOptions: PublicKeyCredentialRequestOptionsJSON = {
                challenge: "mock-auth-challenge-456",
                rpId: "localhost",
                allowCredentials: [{ id: "cred-id-123", type: "public-key" }],
                userVerification: "required",
            };
            mockedGenerateAuthenticationOptions.mockResolvedValue(mockOptions);

            const result = await webAuthnService.beginAuthentication("WRK-001", WebAuthnUserType.WORKER);

            expect(result).toEqual(mockOptions);
            expect(mockedGenerateAuthenticationOptions).toHaveBeenCalledWith(
                expect.objectContaining({
                    rpID: "localhost",
                    allowCredentials: [{ id: "cred-id-123" }],
                    userVerification: "required",
                }),
            );
            expect(challengeStore.store).toHaveBeenCalledWith("WRK-001", "mock-auth-challenge-456");
        });
    });

    describe("completeAuthentication", () => {
        it("should reject completion for unknown user in identity service", async () => {
            identityService.exists.mockResolvedValue(false);

            await expect(
                webAuthnService.completeAuthentication("WRK-001", WebAuthnUserType.WORKER, mockResponse),
            ).rejects.toThrow("User not found");

            expect(identityService.exists).toHaveBeenCalledWith("WRK-001", WebAuthnUserType.WORKER);
            expect(mockedVerifyAuthenticationResponse).not.toHaveBeenCalled();
        });

        it("should reject completion when credential is not found in repository", async () => {
            identityService.exists.mockResolvedValue(true);
            credentialRepository.findByUserId.mockResolvedValue(null);

            await expect(
                webAuthnService.completeAuthentication("WRK-001", WebAuthnUserType.WORKER, mockResponse),
            ).rejects.toThrow("User has no registered credential");

            expect(challengeStore.get).not.toHaveBeenCalled();
            expect(mockedVerifyAuthenticationResponse).not.toHaveBeenCalled();
        });

        it("should reject completion when challenge is missing or expired", async () => {
            identityService.exists.mockResolvedValue(true);
            credentialRepository.findByUserId.mockResolvedValue(mockExistingCredential);
            challengeStore.get.mockResolvedValue(null);

            await expect(
                webAuthnService.completeAuthentication("WRK-001", WebAuthnUserType.WORKER, mockResponse),
            ).rejects.toThrow("Challenge not found or expired");

            expect(challengeStore.get).toHaveBeenCalledWith("WRK-001");
            expect(mockedVerifyAuthenticationResponse).not.toHaveBeenCalled();
        });

        it("should reject completion and delete challenge when verification fails", async () => {
            identityService.exists.mockResolvedValue(true);
            credentialRepository.findByUserId.mockResolvedValue(mockExistingCredential);
            challengeStore.get.mockResolvedValue("expected-auth-challenge");

            mockedVerifyAuthenticationResponse.mockResolvedValue({
                verified: false,
            } as unknown as VerifiedAuthenticationResponse);

            await expect(
                webAuthnService.completeAuthentication("WRK-001", WebAuthnUserType.WORKER, mockResponse),
            ).rejects.toThrow("Authentication verification failed");

            expect(mockedVerifyAuthenticationResponse).toHaveBeenCalledWith(
                expect.objectContaining({
                    response: mockResponse,
                    expectedChallenge: "expected-auth-challenge",
                    credential: {
                        id: "cred-id-123",
                        publicKey: expect.anything(),
                        counter: 5,
                    },
                }),
            );
            expect(challengeStore.delete).toHaveBeenCalledWith("WRK-001");
        });

        it("should successfully verify response, update counter, and delete challenge", async () => {
            identityService.exists.mockResolvedValue(true);
            credentialRepository.findByUserId.mockResolvedValue(mockExistingCredential);
            challengeStore.get.mockResolvedValue("expected-auth-challenge");

            mockedVerifyAuthenticationResponse.mockResolvedValue({
                verified: true,
                authenticationInfo: {
                    credentialID: "cred-id-123",
                    newCounter: 10,
                    userVerified: true,
                    credentialDeviceType: "singleDevice",
                    credentialBackedUp: false,
                    origin: "http://localhost:3000",
                    rpID: "localhost",
                },
            });

            await webAuthnService.completeAuthentication("WRK-001", WebAuthnUserType.WORKER, mockResponse);

            expect(mockedVerifyAuthenticationResponse).toHaveBeenCalledWith(
                expect.objectContaining({
                    response: mockResponse,
                    expectedChallenge: "expected-auth-challenge",
                    credential: {
                        id: "cred-id-123",
                        publicKey: expect.anything(),
                        counter: 5,
                    },
                }),
            );
            expect(mockExistingCredential.counter).toBe(10);
            expect(challengeStore.delete).toHaveBeenCalledWith("WRK-001");
        });
    });
});
