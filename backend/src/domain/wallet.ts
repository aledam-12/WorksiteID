import { WebAuthnUserType } from "./webauthn-credentials.js";
import { PrivateLicenseState } from "./private-license-state.js";

export { PrivateLicenseState };

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
            if (!licenseState || !(licenseState instanceof PrivateLicenseState)) {
                throw new Error("Worker wallet must include private license state");
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
