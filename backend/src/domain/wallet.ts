import { WebAuthnUserType } from "./webauthn-credentials.js";
import { LicenseStatusEnum } from "./license.js";

export interface PrivateLicenseState {
    licenseId: string;
    credits: number;
    status: LicenseStatusEnum;
    randomness: string;
    version: number;
}

export class Wallet {
    constructor(
        public readonly userId: string,
        public readonly userType: WebAuthnUserType,
        public readonly licenseState?: PrivateLicenseState,
    ) {
        if (
            userId === null ||
            userId === undefined ||
            typeof userId !== "string" ||
            userId.trim() === ""
        ) {
            throw new Error("User ID cannot be empty");
        }

        if (
            userType !== WebAuthnUserType.INSPECTOR &&
            userType !== WebAuthnUserType.WORKER
        ) {
            throw new Error("User type cannot be empty or invalid");
        }

        if (userType === WebAuthnUserType.WORKER) {
            if (!licenseState || typeof licenseState !== "object") {
                throw new Error("Worker wallet must include private license state");
            }

            const { licenseId, credits, status, randomness, version } =
                licenseState;

            if (
                licenseId === null ||
                licenseId === undefined ||
                typeof licenseId !== "string" ||
                licenseId.trim() === ""
            ) {
                throw new Error("License ID cannot be empty");
            }

            if (
                credits === null ||
                credits === undefined ||
                typeof credits !== "number" ||
                Number.isNaN(credits) ||
                credits < 0
            ) {
                throw new Error("Credits must be a non-negative number");
            }

            if (
                status === null ||
                status === undefined ||
                !Object.values(LicenseStatusEnum).includes(status)
            ) {
                throw new Error(`Invalid license status: ${status}`);
            }

            if (
                randomness === null ||
                randomness === undefined ||
                typeof randomness !== "string" ||
                randomness.trim() === ""
            ) {
                throw new Error("Randomness cannot be empty");
            }

            if (
                version === null ||
                version === undefined ||
                typeof version !== "number" ||
                !Number.isInteger(version) ||
                version < 1
            ) {
                throw new Error(
                    "Version must be an integer greater than or equal to 1",
                );
            }
        } else {
            if (licenseState !== undefined && licenseState !== null) {
                throw new Error(
                    "Inspector wallet cannot have private license state",
                );
            }
        }
    }
}
