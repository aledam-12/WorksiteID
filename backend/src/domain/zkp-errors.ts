export class ZkpError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "ZkpError";
    }
}

export class InvalidProofError extends ZkpError {
    constructor(message: string = "ZKP Groth16 proof is invalid", options?: ErrorOptions) {
        super(message, options);
        this.name = "InvalidProofError";
    }
}

export class InvalidChallengeError extends ZkpError {
    constructor(message: string = "Challenge is invalid or not found", options?: ErrorOptions) {
        super(message, options);
        this.name = "InvalidChallengeError";
    }
}

export class ExpiredChallengeError extends ZkpError {
    constructor(message: string = "Challenge has expired", options?: ErrorOptions) {
        super(message, options);
        this.name = "ExpiredChallengeError";
    }
}

export class ReplayedChallengeError extends ZkpError {
    constructor(message: string = "Challenge has already been used", options?: ErrorOptions) {
        super(message, options);
        this.name = "ReplayedChallengeError";
    }
}

export class CommitmentMismatchError extends ZkpError {
    constructor(message: string = "Proof commitment does not match on-chain ledger commitment", options?: ErrorOptions) {
        super(message, options);
        this.name = "CommitmentMismatchError";
    }
}

export class LicenseNotFoundError extends ZkpError {
    constructor(message: string = "License not found on ledger", options?: ErrorOptions) {
        super(message, options);
        this.name = "LicenseNotFoundError";
    }
}

export class ZkpConfigError extends ZkpError {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "ZkpConfigError";
    }
}
