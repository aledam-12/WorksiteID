import {
  PrivateLicenseState,
  Wallet,
} from "../../../backend/src/domain/wallet.js";
import { WebAuthnUserType } from "../../../backend/src/domain/webauthn-credentials.js";
import { LicenseStatusEnum } from "../../../backend/src/domain/license.js";
import { CommitmentServiceImpl } from "../../../backend/src/services/commitment-service.js";

describe("Wallet Domain Model", () => {
  const commitmentService = new CommitmentServiceImpl();

  const createValidLicenseState = (
    overrides?: Partial<{
      licenseId: string;
      credits: number;
      status: LicenseStatusEnum;
      randomness: string;
      version: number;
    }>,
  ): PrivateLicenseState =>
    new PrivateLicenseState(
      overrides?.licenseId ?? "LIC-001",
      overrides?.credits ?? 30,
      overrides?.status ?? LicenseStatusEnum.ACTIVE,
      overrides?.randomness ?? commitmentService.generateRandomness(),
      overrides?.version ?? 1,
    );

  it("should instantiate a valid Worker wallet with complete private state", () => {
    const licenseState = createValidLicenseState();
    const wallet = new Wallet(
      "WRK-001",
      WebAuthnUserType.WORKER,
      licenseState,
    );

    expect(wallet.userId).toBe("WRK-001");
    expect(wallet.userType).toBe(WebAuthnUserType.WORKER);
    expect(wallet.licenseState).toBeDefined();
    expect(wallet.licenseState).toBeInstanceOf(PrivateLicenseState);
    expect(wallet.licenseState?.licenseId).toBe("LIC-001");
    expect(wallet.licenseState?.credits).toBe(30);
    expect(wallet.licenseState?.status).toBe(LicenseStatusEnum.ACTIVE);
    expect(wallet.licenseState?.randomness).toBe(licenseState.randomness);
    expect(wallet.licenseState?.version).toBe(1);
  });

  it("should instantiate a valid Inspector wallet without license state", () => {
    const wallet = new Wallet("INSP-001", WebAuthnUserType.INSPECTOR);

    expect(wallet.userId).toBe("INSP-001");
    expect(wallet.userType).toBe(WebAuthnUserType.INSPECTOR);
    expect(wallet.licenseState).toBeUndefined();
  });

  it("should reject a Worker wallet without private license state", () => {
    expect(() => new Wallet("WRK-001", WebAuthnUserType.WORKER)).toThrow(
      "Worker wallet must include private license state",
    );
    expect(
      () => new Wallet("WRK-001", WebAuthnUserType.WORKER, undefined),
    ).toThrow("Worker wallet must include private license state");
  });

  it("should reject an Inspector wallet with private license state", () => {
    const licenseState = createValidLicenseState();
    expect(
      () =>
        new Wallet(
          "INSP-001",
          WebAuthnUserType.INSPECTOR,
          licenseState,
        ),
    ).toThrow("Inspector wallet cannot have private license state");
  });

  it("should allow a Worker wallet with 0 credits", () => {
    const licenseState = createValidLicenseState({
      credits: 0,
      status: LicenseStatusEnum.REVOKED,
    });
    const wallet = new Wallet(
      "WRK-001",
      WebAuthnUserType.WORKER,
      licenseState,
    );

    expect(wallet.licenseState?.credits).toBe(0);
    expect(wallet.licenseState?.status).toBe(LicenseStatusEnum.REVOKED);
  });

  it("should reject an empty or whitespace-only user ID", () => {
    const licenseState = createValidLicenseState();
    expect(
      () => new Wallet("", WebAuthnUserType.WORKER, licenseState),
    ).toThrow("User ID cannot be empty");

    expect(
      () => new Wallet("   ", WebAuthnUserType.WORKER, licenseState),
    ).toThrow("User ID cannot be empty");
  });

  it("should reject an invalid or null user type", () => {
    const licenseState = createValidLicenseState();
    expect(
      () =>
        new Wallet(
          "WRK-001",
          "INVALID" as unknown as WebAuthnUserType,
          licenseState,
        ),
    ).toThrow("User type cannot be empty or invalid");
  });
});
