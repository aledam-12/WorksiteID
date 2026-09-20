import { LicenseStatusEnum } from "./license.js";
import { CommitmentService } from "../services/commitment-service.js";

export class PrivateLicenseState {
    constructor(
        public readonly licenseId: string,
        public readonly credits: number,
        public readonly status: LicenseStatusEnum,
        public readonly randomness: string,
        public readonly version: number,
        public readonly workerId?: string,
        public readonly licenseRef?: string,
        public readonly createdAt?: Date,
        public readonly updatedAt?: Date,
    ) {
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
            !Number.isInteger(credits) ||
            credits < 0
        ) {
            throw new Error("Credits must be a non-negative integer");
        }

        if (
            status === null ||
            status === undefined ||
            !Object.values(LicenseStatusEnum).includes(status)
        ) {
            throw new Error(`Invalid license status: ${status}`);
        }

        if (credits >= 15 && status !== LicenseStatusEnum.ACTIVE) {
            throw new Error(
                `Invalid status for ${credits} credits: status must be ACTIVE when credits >= 15`,
            );
        }

        if (credits < 15 && status !== LicenseStatusEnum.REVOKED) {
            throw new Error(
                `Invalid status for ${credits} credits: status must be REVOKED when credits < 15`,
            );
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
    }

    /**
     * Factory to create an initial PrivateLicenseState with version 1 and CSPRNG randomness.
     */
    static createInitial(
        licenseId: string,
        commitmentService: CommitmentService,
        credits: number = 30,
        status: LicenseStatusEnum = LicenseStatusEnum.ACTIVE,
        workerId?: string,
        licenseRef?: string,
    ): PrivateLicenseState {
        const randomness = commitmentService.generateRandomness();
        return new PrivateLicenseState(
            licenseId,
            credits,
            status,
            randomness,
            1,
            workerId,
            licenseRef,
        );
    }

    /**
     * Returns the canonical state payload (excluding randomness) used for commitment calculation.
     */
    toCommitmentState(): Record<string, unknown> {
        return {
            licenseId: this.licenseId,
            credits: this.credits,
            status: this.status,
            version: this.version,
        };
    }

    /**
     * Calculates the cryptographic commitment using CommitmentService.
     */
    async computeCommitment(commitmentService: CommitmentService): Promise<string> {
        return await commitmentService.createCommitment(
            this.toCommitmentState(),
            this.randomness,
        );
    }

    /**
     * Verifies if a given commitment matches this private state and randomness.
     */
    async verifyCommitment(
        commitmentService: CommitmentService,
        commitment: string,
    ): Promise<boolean> {
        return await commitmentService.verifyCommitment(
            this.toCommitmentState(),
            this.randomness,
            commitment,
        );
    }

    /**
     * Creates an updated PrivateLicenseState with incremented version and fresh CSPRNG randomness.
     */
    nextVersion(
        commitmentService: CommitmentService,
        updates?: {
            credits?: number;
            status?: LicenseStatusEnum;
        },
    ): PrivateLicenseState {
        const nextRandomness = commitmentService.generateRandomness();
        const nextCredits = updates?.credits ?? this.credits;
        const defaultStatus =
            nextCredits >= 15
                ? LicenseStatusEnum.ACTIVE
                : LicenseStatusEnum.REVOKED;
        const nextStatus = updates?.status ?? defaultStatus;
        return new PrivateLicenseState(
            this.licenseId,
            nextCredits,
            nextStatus,
            nextRandomness,
            this.version + 1,
            this.workerId,
            this.licenseRef,
            this.createdAt,
            new Date(),
        );
    }
}
