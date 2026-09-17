import {
    BlockchainService,
    BlockchainServiceImpl,
    IssueSanctionOnChainParams,
} from "../../../backend/src/services/blockchain-service.js";
import {
    FireFlyClient,
    FireFlyHttpError,
} from "../../../backend/src/services/firefly-client.js";
import { LicenseOnChain } from "../../../backend/src/domain/license-on-chain.js";
import { SanctionOnChain } from "../../../backend/src/domain/sanction-on-chain.js";

describe("BlockchainService", () => {
    let mockFireFlyClient: jest.Mocked<FireFlyClient>;
    let blockchainService: BlockchainService;

    beforeEach(() => {
        mockFireFlyClient = {
            invoke: jest.fn(),
            query: jest.fn(),
        };
        blockchainService = new BlockchainServiceImpl(mockFireFlyClient);
    });

    describe("createLicense", () => {
        it("should invoke CreateLicense with licenseRef and initialCommitment", async () => {
            mockFireFlyClient.invoke.mockResolvedValueOnce({ id: "tx-create-1" });

            await blockchainService.createLicense(
                "LIC-REF-001",
                "a".repeat(64),
            );

            expect(mockFireFlyClient.invoke).toHaveBeenCalledTimes(1);
            expect(mockFireFlyClient.invoke).toHaveBeenCalledWith("CreateLicense", {
                licenseRef: "LIC-REF-001",
                initialCommitment: "a".repeat(64),
            });
        });

        it("should reject an empty or whitespace license reference", async () => {
            await expect(
                blockchainService.createLicense("", "a".repeat(64)),
            ).rejects.toThrow("License reference must not be empty");

            await expect(
                blockchainService.createLicense("   ", "a".repeat(64)),
            ).rejects.toThrow("License reference must not be empty");
        });

        it("should reject an empty or whitespace initial commitment", async () => {
            await expect(
                blockchainService.createLicense("LIC-REF-001", ""),
            ).rejects.toThrow("Initial commitment must not be empty");

            await expect(
                blockchainService.createLicense("LIC-REF-001", "   "),
            ).rejects.toThrow("Initial commitment must not be empty");
        });

        it("should propagate errors from FireFlyClient", async () => {
            const fireflyError = new FireFlyHttpError(
                "License already exists",
                400,
                { error: "license LIC-REF-001 already exists" },
            );
            mockFireFlyClient.invoke.mockRejectedValueOnce(fireflyError);

            await expect(
                blockchainService.createLicense("LIC-REF-001", "a".repeat(64)),
            ).rejects.toThrow(fireflyError);
        });
    });

    describe("getLicenseState", () => {
        it("should query GetLicenseState and map to LicenseOnChain", async () => {
            const ledgerData = {
                licenseRef: "LIC-REF-001",
                commitment: "a".repeat(64),
                version: 1,
            };

            mockFireFlyClient.query.mockResolvedValueOnce(ledgerData);

            const licenseState = await blockchainService.getLicenseState("LIC-REF-001");

            expect(mockFireFlyClient.query).toHaveBeenCalledTimes(1);
            expect(mockFireFlyClient.query).toHaveBeenCalledWith("GetLicenseState", {
                licenseRef: "LIC-REF-001",
            });

            expect(licenseState).toBeInstanceOf(LicenseOnChain);
            expect(licenseState?.licenseRef).toBe("LIC-REF-001");
            expect(licenseState?.commitment).toBe("a".repeat(64));
            expect(licenseState?.version).toBe(1);
        });

        it("should return null when license is not found on ledger", async () => {
            mockFireFlyClient.query.mockResolvedValueOnce(null);

            const licenseState = await blockchainService.getLicenseState("NON_EXISTING");

            expect(licenseState).toBeNull();
        });

        it("should reject an empty license reference", async () => {
            await expect(blockchainService.getLicenseState("")).rejects.toThrow(
                "License reference must not be empty",
            );
            await expect(blockchainService.getLicenseState("   ")).rejects.toThrow(
                "License reference must not be empty",
            );
        });

        it("should propagate errors from FireFlyClient without swallowing", async () => {
            const networkError = new Error("FireFly unreachable");
            mockFireFlyClient.query.mockRejectedValueOnce(networkError);

            await expect(
                blockchainService.getLicenseState("LIC-REF-001"),
            ).rejects.toThrow(networkError);
        });
    });

    describe("issueSanction", () => {
        it("should invoke IssueSanction with on-chain commitment parameters", async () => {
            const params: IssueSanctionOnChainParams = {
                sanctionId: "SANCT-001",
                licenseRef: "LIC-REF-001",
                sanctionCommitment: "s".repeat(64),
                newCommitment: "c".repeat(64),
                inspectorRef: "INSP-REF-01",
            };

            mockFireFlyClient.invoke.mockResolvedValueOnce({});

            await blockchainService.issueSanction(params);

            expect(mockFireFlyClient.invoke).toHaveBeenCalledTimes(1);
            expect(mockFireFlyClient.invoke).toHaveBeenCalledWith("IssueSanction", {
                sanctionID: "SANCT-001",
                licenseRef: "LIC-REF-001",
                sanctionCommitment: "s".repeat(64),
                newCommitment: "c".repeat(64),
                inspectorRef: "INSP-REF-01",
            });
        });

        it("should reject empty identifiers and commitments", async () => {
            await expect(
                blockchainService.issueSanction({
                    sanctionId: "",
                    licenseRef: "LIC-REF-001",
                    sanctionCommitment: "s".repeat(64),
                    newCommitment: "c".repeat(64),
                    inspectorRef: "INSP-REF-01",
                }),
            ).rejects.toThrow("Sanction ID must not be empty");

            await expect(
                blockchainService.issueSanction({
                    sanctionId: "SANCT-001",
                    licenseRef: "",
                    sanctionCommitment: "s".repeat(64),
                    newCommitment: "c".repeat(64),
                    inspectorRef: "INSP-REF-01",
                }),
            ).rejects.toThrow("License reference must not be empty");

            await expect(
                blockchainService.issueSanction({
                    sanctionId: "SANCT-001",
                    licenseRef: "LIC-REF-001",
                    sanctionCommitment: "",
                    newCommitment: "c".repeat(64),
                    inspectorRef: "INSP-REF-01",
                }),
            ).rejects.toThrow("Sanction commitment must not be empty");

            await expect(
                blockchainService.issueSanction({
                    sanctionId: "SANCT-001",
                    licenseRef: "LIC-REF-001",
                    sanctionCommitment: "s".repeat(64),
                    newCommitment: "",
                    inspectorRef: "INSP-REF-01",
                }),
            ).rejects.toThrow("New commitment must not be empty");

            await expect(
                blockchainService.issueSanction({
                    sanctionId: "SANCT-001",
                    licenseRef: "LIC-REF-001",
                    sanctionCommitment: "s".repeat(64),
                    newCommitment: "c".repeat(64),
                    inspectorRef: "",
                }),
            ).rejects.toThrow("Inspector reference must not be empty");
        });

        it("should propagate errors from FireFlyClient", async () => {
            const httpError = new FireFlyHttpError(
                "Sanction already exists",
                400,
                { message: "sanction SANCT-001 already exists" },
            );
            mockFireFlyClient.invoke.mockRejectedValueOnce(httpError);

            await expect(
                blockchainService.issueSanction({
                    sanctionId: "SANCT-001",
                    licenseRef: "LIC-REF-001",
                    sanctionCommitment: "s".repeat(64),
                    newCommitment: "c".repeat(64),
                    inspectorRef: "INSP-REF-01",
                }),
            ).rejects.toThrow(httpError);
        });
    });

    describe("getSanction", () => {
        it("should query GetSanction and map response to SanctionOnChain", async () => {
            mockFireFlyClient.query.mockResolvedValueOnce({
                id: "SANCT-001",
                licenseRef: "LIC-REF-001",
                sanctionCommitment: "s".repeat(64),
                issuedAt: "2026-09-08T13:30:00.000Z",
                inspectorRef: "INSP-REF-01",
                version: 2,
            });

            const sanction = await blockchainService.getSanction("SANCT-001");

            expect(mockFireFlyClient.query).toHaveBeenCalledTimes(1);
            expect(mockFireFlyClient.query).toHaveBeenCalledWith("GetSanction", {
                sanctionID: "SANCT-001",
            });

            expect(sanction).toBeInstanceOf(SanctionOnChain);
            expect(sanction?.id).toBe("SANCT-001");
            expect(sanction?.licenseRef).toBe("LIC-REF-001");
            expect(sanction?.sanctionCommitment).toBe("s".repeat(64));
            expect(sanction?.issuedAt).toEqual(new Date("2026-09-08T13:30:00.000Z"));
            expect(sanction?.inspectorRef).toBe("INSP-REF-01");
            expect(sanction?.version).toBe(2);
        });

        it("should return null when sanction is not found on ledger", async () => {
            mockFireFlyClient.query.mockResolvedValueOnce(null);

            const sanction = await blockchainService.getSanction("NON_EXISTING");

            expect(sanction).toBeNull();
        });

        it("should reject an empty sanction ID", async () => {
            await expect(blockchainService.getSanction("")).rejects.toThrow(
                "Sanction ID must not be empty",
            );
        });

        it("should propagate errors from FireFlyClient without swallowing", async () => {
            const error = new Error("FireFly query failed");
            mockFireFlyClient.query.mockRejectedValueOnce(error);

            await expect(blockchainService.getSanction("SANCT-001")).rejects.toThrow(
                error,
            );
        });
    });
});
