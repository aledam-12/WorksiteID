import {
    BlockchainService,
    BlockchainServiceImpl,
    IssueSanctionParams,
} from "../../../backend/src/services/blockchain-service.js";
import {
    FireFlyClient,
    FireFlyHttpError,
} from "../../../backend/src/services/firefly-client.js";
import {
    License,
    LicenseStatusEnum,
} from "../../../backend/src/domain/license.js";
import { Sanction } from "../../../backend/src/domain/sanction.js";

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
        it("should invoke CreateLicense with licenseID and credits", async () => {
            mockFireFlyClient.invoke.mockResolvedValueOnce({ id: "tx-create-1" });

            await blockchainService.createLicense("LIC001", 30);

            expect(mockFireFlyClient.invoke).toHaveBeenCalledTimes(1);
            expect(mockFireFlyClient.invoke).toHaveBeenCalledWith("CreateLicense", {
                licenseID: "LIC001",
                credits: 30,
            });
        });

        it("should require credits and reject invalid credits", async () => {
            await expect(
                blockchainService.createLicense("LIC002", undefined as unknown as number),
            ).rejects.toThrow("Credits must be a valid number");

            await expect(
                blockchainService.createLicense("LIC002", Number.NaN),
            ).rejects.toThrow("Credits must be a valid number");
        });

        it("should reject an empty or whitespace license ID", async () => {
            await expect(blockchainService.createLicense("", 30)).rejects.toThrow(
                "License ID must not be empty",
            );
            await expect(blockchainService.createLicense("   ", 30)).rejects.toThrow(
                "License ID must not be empty",
            );
        });

        it("should propagate errors from FireFlyClient", async () => {
            const fireflyError = new FireFlyHttpError(
                "License already exists",
                400,
                { error: "License already exists" },
            );
            mockFireFlyClient.invoke.mockRejectedValueOnce(fireflyError);

            await expect(
                blockchainService.createLicense("LIC001", 30),
            ).rejects.toThrow(fireflyError);
        });
    });

    describe("getLicense", () => {
        it("should query GetLicense and delegate to License.fromLedger", async () => {
            const fromLedgerSpy = jest.spyOn(License, "fromLedger");
            const ledgerData = {
                id: "LIC001",
                credits: 25,
                status: "ACTIVE",
            };

            mockFireFlyClient.query.mockResolvedValueOnce(ledgerData);

            const license = await blockchainService.getLicense("LIC001");

            expect(mockFireFlyClient.query).toHaveBeenCalledTimes(1);
            expect(mockFireFlyClient.query).toHaveBeenCalledWith("GetLicense", {
                licenseID: "LIC001",
            });
            expect(fromLedgerSpy).toHaveBeenCalledWith(ledgerData);

            expect(license).toBeInstanceOf(License);
            expect(license?.id).toBe("LIC001");
            expect(license?.credits).toBe(25);
            expect(license?.licenseStatus).toBe(LicenseStatusEnum.ACTIVE);

            fromLedgerSpy.mockRestore();
        });

        it("should map REVOKED status correctly to domain License", async () => {
            mockFireFlyClient.query.mockResolvedValueOnce({
                id: "LIC002",
                credits: 10,
                status: "REVOKED",
            });

            const license = await blockchainService.getLicense("LIC002");

            expect(license).toBeInstanceOf(License);
            expect(license?.id).toBe("LIC002");
            expect(license?.credits).toBe(10);
            expect(license?.licenseStatus).toBe(LicenseStatusEnum.REVOKED);
        });

        it("should return null when license is not found on ledger", async () => {
            mockFireFlyClient.query.mockResolvedValueOnce(null);

            const license = await blockchainService.getLicense("NON_EXISTING");

            expect(license).toBeNull();
        });

        it("should reject an empty license ID", async () => {
            await expect(blockchainService.getLicense("")).rejects.toThrow(
                "License ID must not be empty",
            );
        });

        it("should reject unknown status through License.fromLedger", async () => {
            mockFireFlyClient.query.mockResolvedValueOnce({
                id: "LIC003",
                credits: 20,
                status: "UNKNOWN_STATUS",
            });

            await expect(blockchainService.getLicense("LIC003")).rejects.toThrow(
                "Invalid license status: UNKNOWN_STATUS",
            );
        });

        it("should propagate errors from FireFlyClient without swallowing", async () => {
            const networkError = new Error("FireFly unreachable");
            mockFireFlyClient.query.mockRejectedValueOnce(networkError);

            await expect(blockchainService.getLicense("LIC001")).rejects.toThrow(
                networkError,
            );
        });
    });

    describe("issueSanction", () => {
        it("should map IssueSanctionParams with Date to FireFly IssueSanction input", async () => {
            const issuedAt = new Date("2026-09-08T13:30:00.000Z");
            const params: IssueSanctionParams = {
                sanctionId: "SAN001",
                licenseId: "LIC001",
                inspectorId: "INSP_042",
                penalty: 5,
                reason: "Mancata verifica DPI",
                issuedAt,
            };

            mockFireFlyClient.invoke.mockResolvedValueOnce({});

            await blockchainService.issueSanction(params);

            expect(mockFireFlyClient.invoke).toHaveBeenCalledTimes(1);
            expect(mockFireFlyClient.invoke).toHaveBeenCalledWith("IssueSanction", {
                sanctionID: "SAN001",
                licenseID: "LIC001",
                inspectorID: "INSP_042",
                penalty: 5,
                reason: "Mancata verifica DPI",
                issuedAt: "2026-09-08T13:30:00.000Z",
            });
        });

        it("should accept valid ISO date string in IssueSanctionParams", async () => {
            const params: IssueSanctionParams = {
                sanctionId: "SAN002",
                licenseId: "LIC001",
                inspectorId: "INSP_042",
                penalty: 10,
                reason: "Mancato uso casco protettivo",
                issuedAt: "2026-09-08T14:00:00.000Z",
            };

            mockFireFlyClient.invoke.mockResolvedValueOnce({});

            await blockchainService.issueSanction(params);

            expect(mockFireFlyClient.invoke).toHaveBeenCalledWith("IssueSanction", {
                sanctionID: "SAN002",
                licenseID: "LIC001",
                inspectorID: "INSP_042",
                penalty: 10,
                reason: "Mancato uso casco protettivo",
                issuedAt: "2026-09-08T14:00:00.000Z",
            });
        });

        it("should reject invalid or missing issuedAt values without generating a fallback", async () => {
            await expect(
                blockchainService.issueSanction({
                    sanctionId: "SAN001",
                    licenseId: "LIC001",
                    inspectorId: "INSP_042",
                    penalty: 5,
                    reason: "test",
                    issuedAt: undefined as unknown as Date,
                }),
            ).rejects.toThrow("issuedAt must be a valid Date or ISO date string");

            await expect(
                blockchainService.issueSanction({
                    sanctionId: "SAN001",
                    licenseId: "LIC001",
                    inspectorId: "INSP_042",
                    penalty: 5,
                    reason: "test",
                    issuedAt: new Date("invalid-date"),
                }),
            ).rejects.toThrow("issuedAt must be a valid Date");

            await expect(
                blockchainService.issueSanction({
                    sanctionId: "SAN001",
                    licenseId: "LIC001",
                    inspectorId: "INSP_042",
                    penalty: 5,
                    reason: "test",
                    issuedAt: "not-a-valid-date",
                }),
            ).rejects.toThrow("issuedAt must be a valid Date");
        });

        it("should reject empty identifiers in sanction params", async () => {
            await expect(
                blockchainService.issueSanction({
                    sanctionId: "",
                    licenseId: "LIC001",
                    inspectorId: "INSP_042",
                    penalty: 5,
                    reason: "test",
                    issuedAt: new Date(),
                }),
            ).rejects.toThrow("Sanction ID must not be empty");

            await expect(
                blockchainService.issueSanction({
                    sanctionId: "SAN001",
                    licenseId: "",
                    inspectorId: "INSP_042",
                    penalty: 5,
                    reason: "test",
                    issuedAt: new Date(),
                }),
            ).rejects.toThrow("License ID must not be empty");

            await expect(
                blockchainService.issueSanction({
                    sanctionId: "SAN001",
                    licenseId: "LIC001",
                    inspectorId: "",
                    penalty: 5,
                    reason: "test",
                    issuedAt: new Date(),
                }),
            ).rejects.toThrow("Inspector ID must not be empty");
        });

        it("should propagate errors from FireFlyClient", async () => {
            const httpError = new FireFlyHttpError(
                "License not found",
                500,
                { message: "License not found" },
            );
            mockFireFlyClient.invoke.mockRejectedValueOnce(httpError);

            await expect(
                blockchainService.issueSanction({
                    sanctionId: "SAN001",
                    licenseId: "LIC_UNKNOWN",
                    inspectorId: "INSP_042",
                    penalty: 5,
                    reason: "test",
                    issuedAt: new Date(),
                }),
            ).rejects.toThrow(httpError);
        });
    });

    describe("getSanction", () => {
        it("should query GetSanction and map response to domain Sanction", async () => {
            mockFireFlyClient.query.mockResolvedValueOnce({
                id: "SAN001",
                licenseId: "LIC001",
                penalty: 5,
                reason: "Mancata verifica DPI",
                issuedAt: "2026-09-08T13:30:00.000Z",
                inspectorId: "INSP_042",
            });

            const sanction = await blockchainService.getSanction("SAN001");

            expect(mockFireFlyClient.query).toHaveBeenCalledTimes(1);
            expect(mockFireFlyClient.query).toHaveBeenCalledWith("GetSanction", {
                sanctionID: "SAN001",
            });

            expect(sanction).toBeInstanceOf(Sanction);
            expect(sanction?.id).toBe("SAN001");
            expect(sanction?.licenseId).toBe("LIC001");
            expect(sanction?.penalty).toBe(5);
            expect(sanction?.reason).toBe("Mancata verifica DPI");
            expect(sanction?.inspectorId).toBe("INSP_042");
            expect(sanction?.issuedAt).toEqual(new Date("2026-09-08T13:30:00.000Z"));
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

            await expect(blockchainService.getSanction("SAN001")).rejects.toThrow(
                error,
            );
        });
    });
});
