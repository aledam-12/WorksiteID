import type {
    PublicKeyCredentialCreationOptionsJSON,
    PublicKeyCredentialRequestOptionsJSON,
    RegistrationResponseJSON,
    AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { generateRegistrationOptions, generateAuthenticationOptions, verifyRegistrationResponse, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL, isoUint8Array } from "@simplewebauthn/server/helpers";
import { CredentialRepository } from "../repositories/credential-repository.js";
import { WebAuthnCredentials, WebAuthnUserType } from "../domain/webauthn-credentials.js";
import { IdentityService } from "./identity-service.js";
import { ChallengeStore } from "../repositories/challenge-store.js";

export interface WebAuthnService {
    beginRegistration(userId: string, userType: WebAuthnUserType): Promise<PublicKeyCredentialCreationOptionsJSON>;
    completeRegistration(userId: string, userType: WebAuthnUserType, response: RegistrationResponseJSON): Promise<void>;
    beginAuthentication(userId: string, userType: WebAuthnUserType): Promise<PublicKeyCredentialRequestOptionsJSON>;
    completeAuthentication(userId: string, userType: WebAuthnUserType, response: AuthenticationResponseJSON): Promise<void>;
    readonly credentialRepository: CredentialRepository;
}

export class WebAuthnServiceImpl implements WebAuthnService {
    constructor(
        readonly credentialRepository: CredentialRepository,
        readonly identityService: IdentityService,
        readonly challengeStore: ChallengeStore,
    ) { }

    async beginRegistration(userId: string, userType: WebAuthnUserType): Promise<PublicKeyCredentialCreationOptionsJSON> {
        const creds = await this.credentialRepository.findByUserId(userId);
        if (!(await this.identityService.exists(userId, userType))) {
            throw new Error("User not found");
        }
        const hasCred = Array.isArray(creds) ? creds.length > 0 : creds !== null;
        if (hasCred) {
            throw new Error("User already has a credential");
        }

        const options = await generateRegistrationOptions({
            rpName: "worksiteID",
            rpID: process.env.RP_ID ?? "localhost",
            userName: userId,
            userID: isoUint8Array.fromUTF8String(userId),
            attestationType: "none",
            authenticatorSelection: {
                userVerification: "required",
                residentKey: "required",
            },
        });

        await this.challengeStore.store(userId, options.challenge);

        return options;
    }

    async completeRegistration(userId: string, userType: WebAuthnUserType, response: RegistrationResponseJSON): Promise<void> {
        if (!(await this.identityService.exists(userId, userType))) {
            throw new Error("User not found");
        }

        const creds = await this.credentialRepository.findByUserId(userId);
        const hasCred = Array.isArray(creds) ? creds.length > 0 : creds !== null;
        if (hasCred) {
            throw new Error("User already has a credential");
        }

        const expectedChallenge = await this.challengeStore.get(userId);
        if (!expectedChallenge) {
            throw new Error("Challenge not found or expired");
        }



        const verification = await verifyRegistrationResponse({
            response,
            expectedChallenge,
            expectedOrigin: process.env.ORIGIN ?? "http://localhost:3000",
            expectedRPID: process.env.RP_ID ?? "localhost",
        });



        if (!verification.verified || !verification.registrationInfo) {
            await this.challengeStore.delete(userId);
            throw new Error("Registration verification failed");
        }



        const { credential } = verification.registrationInfo;

        const webAuthnCredential = new WebAuthnCredentials(
            credential.id,
            userId,
            userType,
            isoBase64URL.fromBuffer(credential.publicKey),
            credential.counter,
        );

        await this.credentialRepository.register(webAuthnCredential);
        await this.challengeStore.delete(userId);
    }

    async beginAuthentication(userId: string, userType: WebAuthnUserType): Promise<PublicKeyCredentialRequestOptionsJSON> {
        if (!(await this.identityService.exists(userId, userType))) {
            throw new Error("User not found");
        }

        const creds = await this.credentialRepository.findByUserId(userId);
        const credList = Array.isArray(creds) ? creds : (creds ? [creds] : []);
        if (credList.length === 0) {
            throw new Error("User has no registered credential");
        }

        const options = await generateAuthenticationOptions({
            rpID: process.env.RP_ID ?? "localhost",
            allowCredentials: credList.map((c) => ({
                id: c.id,
            })),
            userVerification: "required",
        });

        await this.challengeStore.store(userId, options.challenge);

        return options;
    }

    async completeAuthentication(userId: string, userType: WebAuthnUserType, response: AuthenticationResponseJSON): Promise<void> {
        if (!(await this.identityService.exists(userId, userType))) {
            throw new Error("User not found");
        }

        const creds = await this.credentialRepository.findByUserId(userId);
        const credList = Array.isArray(creds) ? creds : (creds ? [creds] : []);
        if (credList.length === 0) {
            throw new Error("User has no registered credential");
        }
        const cred = credList.find((c) => c.id === response.id) ?? credList[0]!;

        const expectedChallenge = await this.challengeStore.get(userId);
        if (!expectedChallenge) {
            throw new Error("Challenge not found or expired");
        }

        const verification = await verifyAuthenticationResponse({
            response,
            expectedChallenge,
            expectedOrigin: process.env.ORIGIN ?? "http://localhost:3000",
            expectedRPID: process.env.RP_ID ?? "localhost",
            credential: {
                id: cred.id,
                publicKey: isoBase64URL.toBuffer(cred.publicKey),
                counter: cred.counter,
            },
        });

        if (!verification.verified || !verification.authenticationInfo) {
            await this.challengeStore.delete(userId);
            throw new Error("Authentication verification failed");
        }

        if (verification.authenticationInfo.newCounter > cred.counter) {
            cred.updateCounter(verification.authenticationInfo.newCounter);
        }

        await this.challengeStore.delete(userId);
    }
}